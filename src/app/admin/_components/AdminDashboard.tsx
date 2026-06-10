"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import {
  X,
  LogOut,
  Users,
  AlertTriangle,
  Clock,
  Inbox,
  Calendar,
  Mail,
  Phone,
  MessageSquare,
  UserPlus,
  FileText,
  ArrowRight,
  Download,
  LayoutGrid,
  Send,
  RefreshCw,
  CheckCheck,
  Bell,
  Reply,
  ChevronLeft,
  Facebook,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Lead = {
  id: string;
  created_at: string;
  updated_at: string | null;
  name: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  website_or_facebook: string | null;
  website_url: string | null;
  facebook_url: string | null;
  business_type: string | null;
  help_needed: string | null;
  message: string | null;
  urgency: "emergency" | "priority" | "normal";
  status: "prospect" | "new" | "contacted" | "interested" | "quoted" | "booked" | "completed" | "lost" | "not_a_fit";
  source: string | null;
  notes: string | null;
  follow_up_date: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  has_unread_messages: boolean;
  needs_response: boolean;
  unread_count: number;
  facebook_sender_id: string | null;
  fit_score: number | null;
  outreach_status: string | null;
  prospect_checklist: Record<string, boolean> | null;
};

type LeadNote = {
  id: string;
  lead_id: string;
  note: string;
  created_at: string;
};

type Message = {
  id: string;
  lead_id: string;
  channel: string;
  direction: string;
  body: string;
  created_at: string;
};

type Activity = {
  id: string;
  lead_id: string;
  type: string;
  label: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ScheduleEvent = {
  id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  event_type: string;
  start_at: string;
  end_at: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  lead: { name: string; email: string | null; phone: string | null; source: string | null } | null;
};

// A normalized calendar row — either a real schedule_event or a synthetic
// follow-up derived from a lead's follow_up_date.
type CalItem = {
  key: string;
  kind: "event" | "followup";
  eventId: string | null;   // schedule_events.id (null for follow-ups)
  leadId: string | null;
  title: string;
  eventType: string;
  startAt: string;
  endAt: string | null;
  description: string | null;
  status: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  leadSource: string | null;
};

type DetailTab = "overview" | "messages" | "notes" | "timeline";

const STATUS_OPTIONS = [
  "prospect",
  "new",
  "contacted",
  "interested",
  "quoted",
  "booked",
  "completed",
  "lost",
  "not_a_fit",
] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_LABELS: Record<Status, string> = {
  prospect: "Prospect",
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  quoted: "Quoted",
  booked: "Booked",
  completed: "Completed",
  lost: "Lost",
  not_a_fit: "Not a fit",
};

const STATUS_COLORS: Record<Status, string> = {
  prospect: "bg-violet-100 text-violet-700",
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  interested: "bg-teal-100 text-teal-700",
  quoted: "bg-purple-100 text-purple-700",
  booked: "bg-green-100 text-green-700",
  completed: "bg-slate-100 text-slate-600",
  lost: "bg-red-100 text-red-600",
  not_a_fit: "bg-gray-100 text-gray-500",
};

// ─── Prospecting ───────────────────────────────────────────────────────────────

const OUTREACH_STATUS_OPTIONS = [
  "not_contacted",
  "outreach_sent",
  "follow_up_needed",
  "replied",
  "interested",
  "not_interested",
  "bad_fit",
] as const;
type OutreachStatus = (typeof OUTREACH_STATUS_OPTIONS)[number];

const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  not_contacted: "Not contacted",
  outreach_sent: "Outreach sent",
  follow_up_needed: "Follow-up needed",
  replied: "Replied",
  interested: "Interested",
  not_interested: "Not interested",
  bad_fit: "Bad fit",
};

// Qualification checklist — key → label. Stored as { key: true } in prospect_checklist.
const PROSPECT_CHECKLIST: { key: string; label: string }[] = [
  { key: "no_website", label: "No website" },
  { key: "bad_website", label: "Bad/old website" },
  { key: "facebook_only", label: "Facebook-only business" },
  { key: "no_lead_form", label: "No clear lead form" },
  { key: "slow_inquiry", label: "Slow/manual inquiry process" },
  { key: "no_booking", label: "No online booking/request flow" },
  { key: "poor_google", label: "Poor Google presence" },
  { key: "good_fit", label: "Good local fit" },
  { key: "visible_demand", label: "Has visible demand/jobs" },
  { key: "looks_active", label: "Looks active" },
];

const PROSPECTING_STATUSES = new Set<string>(["prospect", "contacted"]);

// Quick "likely need" chips for the prospecting panel.
const HELP_CHIPS = ["Website", "Lead system", "Follow-up system", "Messaging hub", "Not sure yet", "Other"];

// Keeps the first occurrence of each lead id — guards against optimistic insert +
// realtime/polling racing and producing duplicate React keys.
function dedupeLeadsById(leads: Lead[]): Lead[] {
  const seen = new Set<string>();
  const out: Lead[] = [];
  for (const l of leads) {
    if (!seen.has(l.id)) { seen.add(l.id); out.push(l); }
  }
  return out;
}

function hasProspectData(l: Lead): boolean {
  return (
    !!l.fit_score ||
    (!!l.outreach_status && l.outreach_status !== "not_contacted") ||
    (!!l.prospect_checklist && Object.keys(l.prospect_checklist).length > 0)
  );
}

function isFacebookUrl(u: string): boolean {
  const s = u.toLowerCase();
  return s.includes("facebook.com") || s.includes("fb.com") || s.includes("fb.me");
}
function hrefFor(u: string): string {
  return u.startsWith("http") ? u : `https://${u}`;
}
// Resolves a lead's Website and Facebook links, falling back to the legacy
// combined website_or_facebook field by URL type so old data isn't lost.
function effectiveLinks(lead: Lead): { website: string | null; facebook: string | null } {
  const legacy = lead.website_or_facebook?.trim() || null;
  const legacyIsFb = legacy ? isFacebookUrl(legacy) : false;
  return {
    website: lead.website_url?.trim() || (legacy && !legacyIsFb ? legacy : null),
    facebook: lead.facebook_url?.trim() || (legacy && legacyIsFb ? legacy : null),
  };
}

const SOURCE_OPTIONS = [
  "website", "facebook", "phone", "text", "email", "referral", "manual", "other",
] as const;
type Source = (typeof SOURCE_OPTIONS)[number];

const SOURCE_LABELS: Record<Source, string> = {
  website: "Website",
  facebook: "Facebook",
  phone: "Phone",
  text: "Text",
  email: "Email",
  referral: "Referral",
  manual: "Manual",
  other: "Other",
};

const SOURCE_COLORS: Record<Source, string> = {
  website: "bg-blue-100 text-blue-700",
  facebook: "bg-indigo-100 text-indigo-700",
  phone: "bg-green-100 text-green-700",
  text: "bg-emerald-100 text-emerald-700",
  email: "bg-amber-100 text-amber-700",
  referral: "bg-purple-100 text-purple-700",
  manual: "bg-slate-100 text-slate-600",
  other: "bg-gray-100 text-gray-600",
};

const DIRECTION_LABELS: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
  internal: "Internal",
};

const DIRECTION_ACTIVITY_LABELS: Record<string, string> = {
  inbound: "Customer replied",
  outbound: "You replied",
  internal: "Internal update",
};

type ActivityStyle = { Icon: React.ElementType; bg: string; color: string };

const ACTIVITY_STYLES: Record<string, ActivityStyle> = {
  lead_created: { Icon: UserPlus, bg: "bg-blue-50", color: "text-blue-500" },
  message_created: { Icon: MessageSquare, bg: "bg-indigo-50", color: "text-indigo-500" },
  note_added: { Icon: FileText, bg: "bg-slate-100", color: "text-slate-500" },
  status_changed: { Icon: ArrowRight, bg: "bg-amber-50", color: "text-amber-500" },
  follow_up_set: { Icon: Calendar, bg: "bg-green-50", color: "text-green-500" },
  calendar_exported: { Icon: Download, bg: "bg-slate-100", color: "text-slate-500" },
  urgency_changed: { Icon: AlertTriangle, bg: "bg-red-50", color: "text-red-500" },
  schedule_event_created: { Icon: Clock, bg: "bg-blue-50", color: "text-blue-500" },
  schedule_event_completed: { Icon: CheckCheck, bg: "bg-green-50", color: "text-green-500" },
  outreach_logged: { Icon: Send, bg: "bg-violet-50", color: "text-violet-500" },
  outreach_status_changed: { Icon: ArrowRight, bg: "bg-violet-50", color: "text-violet-500" },
  fit_score_changed: { Icon: AlertTriangle, bg: "bg-violet-50", color: "text-violet-500" },
  prospect_converted: { Icon: ArrowRight, bg: "bg-green-50", color: "text-green-500" },
  prospect_disqualified: { Icon: X, bg: "bg-slate-100", color: "text-slate-400" },
};

const DEFAULT_ACTIVITY_STYLE: ActivityStyle = {
  Icon: Clock,
  bg: "bg-slate-100",
  color: "text-slate-400",
};

const DETAIL_TABS: { id: DetailTab; label: string; Icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "messages", label: "Messages", Icon: MessageSquare },
  { id: "notes", label: "Notes", Icon: FileText },
  { id: "timeline", label: "Timeline", Icon: Clock },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNoteDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} at ${time}`;
}

function formatShortDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

function isFollowUpOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return new Date(iso) <= todayEnd;
}

function isFollowUpToday(iso: string | null): boolean {
  if (!iso) return false;
  const today = new Date();
  const d = new Date(iso);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function isFollowUpPastDue(iso: string | null): boolean {
  if (!iso) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return new Date(iso) < todayStart;
}

function formatMonthDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// Strips spaces, brackets, and dashes from phone numbers for tel: links.
// Preserves a leading + for international numbers.
function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, "");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r?\n/g, "\\n");
}

// Generates an .ics calendar event for a lead follow-up.
// Uses floating local time (no timezone suffix) so the event lands at 9:00 AM
// in whatever timezone the user's calendar is set to.
//
// TODO: Full calendar integration (Google Calendar OAuth, Outlook OAuth)
// should be implemented later. Apple/iCloud would require CalDAV or manual .ics.
function generateIcs(lead: Lead): string {
  const dateStr = lead.follow_up_date!.split("T")[0].replace(/-/g, "");
  const dtstamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const title = escapeIcsText(`Follow up with ${lead.business_name || lead.name}`);
  // Join with actual newlines so escapeIcsText converts them to ICS \n (line break).
  // Using "\\n" here would be doubled by the backslash-escape step and show as literal \n text.
  const descLines = [
    `Name: ${lead.name}`,
    `Business: ${lead.business_name}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.help_needed ? `Help needed: ${lead.help_needed}` : null,
    lead.message ? `Message: ${lead.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Onward Systems//Admin//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:followup-${lead.id}@onwardsystems.ca`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dateStr}T090000`,
    `DTEND:${dateStr}T093000`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${escapeIcsText(descLines)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(lead: Lead) {
  const content = generateIcs(lead);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `followup-${(lead.business_name || lead.name).replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  follow_up: "Follow-up",
  call: "Call",
  estimate: "Estimate",
  job: "Job",
  reminder: "Reminder",
  other: "Other",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  follow_up: "bg-blue-100 text-blue-700",
  call: "bg-purple-100 text-purple-700",
  estimate: "bg-amber-100 text-amber-700",
  job: "bg-green-100 text-green-700",
  reminder: "bg-slate-100 text-slate-600",
  other: "bg-gray-100 text-gray-600",
};

const EVENT_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-600",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-500",
  missed: "bg-red-100 text-red-600",
};

// Converts an ISO timestamp to ICS UTC format: YYYYMMDDTHHMMSSZ
function icsUtcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Builds an .ics calendar event for a single schedule item.
//
// TODO: Add a private calendar subscription feed so owners can subscribe from
// Apple/Google/Outlook without OAuth (one read-only URL streaming all events).
// Not built yet — this generates a single downloadable event for now.
function generateEventIcs(item: CalItem): string {
  const start = icsUtcStamp(item.startAt);
  // Default to a 30-minute block when no end time is set
  const end = item.endAt
    ? icsUtcStamp(item.endAt)
    : icsUtcStamp(new Date(new Date(item.startAt).getTime() + 30 * 60 * 1000).toISOString());
  const dtstamp = icsUtcStamp(new Date().toISOString());

  const descLines = [
    item.leadName ? `Lead: ${item.leadName}` : null,
    item.leadPhone ? `Phone: ${item.leadPhone}` : null,
    item.leadEmail ? `Email: ${item.leadEmail}` : null,
    item.leadSource ? `Source: ${item.leadSource}` : null,
    `Type: ${EVENT_TYPE_LABELS[item.eventType] ?? item.eventType}`,
    item.description ? `Notes: ${item.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Onward Systems//Admin//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${item.eventId ?? item.leadId ?? item.key}@onwardsystems.ca`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(item.title)}`,
    `DESCRIPTION:${escapeIcsText(descLines)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadEventIcs(item: CalItem) {
  const content = generateEventIcs(item);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${item.title.replace(/\s+/g, "-").slice(0, 40)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Time parsing (12-hour, business-friendly) ────────────────────────────────

// Parses loose user time input into a 12-hour { h, m }. Accepts:
//   "9" → 9:00, "12" → 12:00, "930" → 9:30, "325" → 3:25,
//   "0325"/"1230" → 3:25/12:30, "3:25" → 3:25.
// Returns null if it can't parse a valid 1–12 hour / 0–59 minute time.
function parseTime12(raw: string): { h: number; m: number } | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase().replace(/[ap]\.?m\.?/g, "").trim();
  let h: number, m: number;
  if (s.includes(":")) {
    const [hp, mp] = s.split(":");
    h = parseInt(hp, 10);
    m = parseInt(mp || "0", 10);
  } else {
    s = s.replace(/\D/g, "");
    if (!s) return null;
    if (s.length <= 2) { h = parseInt(s, 10); m = 0; }
    else if (s.length === 3) { h = parseInt(s.slice(0, 1), 10); m = parseInt(s.slice(1), 10); }
    else { const d = s.slice(-4); h = parseInt(d.slice(0, 2), 10); m = parseInt(d.slice(2), 10); }
  }
  if (isNaN(h) || isNaN(m) || m < 0 || m > 59) return null;
  if (h === 0) h = 12;
  if (h < 1 || h > 12) return null;
  return { h, m };
}

function formatTime12(p: { h: number; m: number }): string {
  return `${p.h}:${String(p.m).padStart(2, "0")}`;
}

// Converts a parsed 12-hour time + meridiem to a 24-hour "HH:MM" string.
function to24hFrom12(p: { h: number; m: number }, ampm: string): string {
  let h = p.h % 12; // 12 → 0
  if (ampm === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(p.m).padStart(2, "0")}`;
}

// Common clock times (12-hour, 15-min increments) for the dropdown.
const COMMON_TIMES: string[] = (() => {
  const out: string[] = [];
  for (const h of [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    for (const m of [0, 15, 30, 45]) out.push(`${h}:${String(m).padStart(2, "0")}`);
  }
  return out;
})();

// Friendly time input: text field (type 325 → 3:25) + AM/PM select + a clock
// dropdown of common times. Formats on Enter, Tab, and blur; selects all on focus.
function TimeField({
  time, ampm, onTimeChange, onAmpmChange,
}: {
  time: string;
  ampm: string;
  onTimeChange: (v: string) => void;
  onAmpmChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ampmRef = useRef<HTMLSelectElement>(null);
  const activeOptRef = useRef<HTMLButtonElement>(null);

  const normalized = (() => { const p = parseTime12(time); return p ? formatTime12(p) : null; })();

  function normalize() {
    if (normalized && normalized !== time) onTimeChange(normalized);
  }

  // When the dropdown opens, scroll the matching option into view
  useEffect(() => {
    if (open) activeOptRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  function pick(value: string) {
    onTimeChange(value);
    setOpen(false);
    // Move to AM/PM next — natural keyboard flow
    setTimeout(() => ampmRef.current?.focus(), 0);
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1 min-w-0">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.currentTarget.select()}
          onBlur={() => { normalize(); setOpen(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              normalize();
              setOpen(false);
              ampmRef.current?.focus();
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              setOpen(false);
            }
          }}
          placeholder="9:00"
          className="w-full text-sm border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Common times"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors duration-150"
        >
          <Clock size={13} />
        </button>
        {open && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {COMMON_TIMES.map((opt) => {
              const isActive = opt === normalized;
              return (
                <button
                  key={opt}
                  type="button"
                  ref={isActive ? activeOptRef : undefined}
                  onMouseDown={(e) => { e.preventDefault(); pick(opt); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors duration-100 ${
                    isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <select
        ref={ampmRef}
        value={ampm}
        onChange={(e) => onAmpmChange(e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-2 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as Status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {STATUS_LABELS[status as Status] ?? status}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === "emergency") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertTriangle size={10} />
        Emergency
      </span>
    );
  }
  if (urgency === "priority") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <AlertTriangle size={10} />
        Priority
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
      Normal
    </span>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const color = SOURCE_COLORS[source as Source] ?? "bg-gray-100 text-gray-600";
  const label = SOURCE_LABELS[source as Source] ?? source;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function InfoRow({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex gap-3 text-sm flex-1 min-w-0">
        <span className="text-slate-400 w-28 shrink-0 pt-px">{label}</span>
        <span className="text-slate-700 flex-1 min-w-0" style={{ overflowWrap: "anywhere" }}>{value}</span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard({
  initialLeads,
}: {
  initialLeads: Lead[];
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  // Top-level view: default to Inbox when conversations need a response
  const [topTab, setTopTab] = useState<"inbox" | "leads" | "calendar">(() =>
    initialLeads.some((l) => l.needs_response) ? "inbox" : "leads"
  );
  const [inboxFilter, setInboxFilter] = useState<"all" | "needs_response" | "unread" | "email" | "facebook">("all");

  // Calendar / schedule
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [calendarFilter, setCalendarFilter] = useState<"today" | "week" | "upcoming" | "overdue" | "all">("upcoming");
  const [calendarView, setCalendarView] = useState<"calendar" | "schedule">("calendar");
  // The month grid is cramped on phones — default to the Schedule list there.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setCalendarView("schedule");
  }, []);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedEvent, setSelectedEvent] = useState<CalItem | null>(null);
  const [eventOpenedFrom, setEventOpenedFrom] = useState<"calendar" | "lead">("calendar");
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);

  // Prospecting outreach state
  const [showOutreach, setShowOutreach] = useState(false);
  const [outreachDraft, setOutreachDraft] = useState({ channel: "facebook", body: "", outreachStatus: "outreach_sent", scheduleFollowUp: false });
  const [outreachSaving, setOutreachSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [prospectCollapsed, setProspectCollapsed] = useState(false);
  // Inline "Help needed" editing inside the prospecting panel
  const [helpDraft, setHelpDraft] = useState("");
  const [editingHelp, setEditingHelp] = useState(false);
  const emptyEventForm = {
    lead_id: "",
    title: "",
    event_type: "follow_up",
    start_date: "",
    start_time: "9:00",
    start_ampm: "AM",
    end_date: "",
    end_time: "",
    end_ampm: "AM",
    description: "",
    status: "scheduled",
  };
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [eventError, setEventError] = useState<string | null>(null);
  const [leadQuery, setLeadQuery] = useState("");
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const addEventLeadRef = useRef<HTMLInputElement>(null);
  const addEventStartRef = useRef<HTMLInputElement>(null);
  const scheduleTitleRef = useRef<HTMLInputElement>(null);
  // When the Add modal is opened from a message, lead+description are prefilled,
  // so focus the start date instead of the lead search.
  const focusEventStartRef = useRef(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [needsResponseFilter, setNeedsResponseFilter] = useState(false);
  const [followUpDueFilter, setFollowUpDueFilter] = useState(false);
  const [showFilters, setShowFilters] = useState(false); // mobile collapsible dropdowns
  const [messagesRefreshing, setMessagesRefreshing] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [replyChannel, setReplyChannel] = useState("email");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add-message-as-note tracking
  const [savingNoteForMsgId, setSavingNoteForMsgId] = useState<string | null>(null);
  const [addedNoteForMsgId, setAddedNoteForMsgId] = useState<string | null>(null);

  // Inline lead editing
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: "",
    business_name: "",
    email: "",
    phone: "",
    website_url: "",
    facebook_url: "",
    business_type: "",
    help_needed: "",
    message: "",
    urgency: "normal" as "emergency" | "priority" | "normal",
  });

  // Notes state
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteHistory, setNoteHistory] = useState<LeadNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  // Latest message per lead — drives the Inbox conversation previews
  const [latestMsgByLead, setLatestMsgByLead] = useState<Record<string, Message>>({});
  const [messageDraft, setMessageDraft] = useState({ channel: "manual", direction: "inbound", body: "" });
  const [messageSaving, setMessageSaving] = useState(false);

  // Activities state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Email reply state
  const [emailDraft, setEmailDraft] = useState({ subject: "Re: Your request with Onward Systems", body: "" });
  const [emailSending, setEmailSending] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add Lead modal state
  const [showAddLead, setShowAddLead] = useState(false);
  const [addLeadSaving, setAddLeadSaving] = useState(false);
  const [addLeadForm, setAddLeadForm] = useState({
    name: "",
    business_name: "",
    email: "",
    phone: "",
    website_url: "",
    facebook_url: "",
    business_type: "",
    help_needed: "",
    message: "",
    source: "manual",
    urgency: "normal" as "emergency" | "priority" | "normal",
    status: "new" as Lead["status"],
  });

  const selectedLead = leads.find((l) => l.id === selectedId) ?? null;
  const threadRef = useRef<HTMLDivElement>(null);
  const justLoadedRef = useRef(false);

  // Fetch notes, messages, and activities whenever a different lead is selected
  useEffect(() => {
    setNoteDraft("");
    setNoteHistory([]);
    setMessages([]);
    setMessageDraft({ channel: "manual", direction: "inbound", body: "" });
    setActivities([]);
    setActiveTab("overview");
    setEmailDraft({ subject: "Re: Your request with Onward Systems", body: "" });
    setEmailFeedback(null);
    setShowLogForm(false);
    setReplyChannel("email");
    setShowDeleteConfirm(false);
    setDeleteError(null);
    setIsEditingDetails(false);
    setEditFeedback(null);
    setSavingNoteForMsgId(null);
    setAddedNoteForMsgId(null);
    setShowScheduleForm(false);
    setShowOutreach(false);
    setOutreachDraft({ channel: "facebook", body: "", outreachStatus: "outreach_sent", scheduleFollowUp: false });
    setCopyFeedback(false);
    setEditingHelp(false);
    // Collapse the prospecting panel by default once there is data to summarize
    const lead = initialLeads.find((l) => l.id === selectedId) ?? leads.find((l) => l.id === selectedId);
    setProspectCollapsed(lead ? hasProspectData(lead) : false);
    setHelpDraft(lead?.help_needed ?? "");

    if (!selectedId) return;

    setNotesLoading(true);
    fetch(`/api/admin/leads/${selectedId}/notes`)
      .then((r) => r.json())
      .then(({ data }) => setNoteHistory(data ?? []))
      .catch((err) => console.error("[admin] failed to load notes:", err))
      .finally(() => setNotesLoading(false));

    setMessagesLoading(true);
    fetch(`/api/admin/leads/${selectedId}/messages`)
      .then((r) => r.json())
      .then(({ data }) => {
        const msgs: Message[] = data ?? [];
        justLoadedRef.current = true;
        setMessages(msgs);
        // Pick the best reply channel based on the most recent inbound message
        const lead = leads.find((l) => l.id === selectedId);
        const lastInbound = [...msgs].reverse().find((m) => m.direction === "inbound");
        if (lastInbound?.channel === "facebook" && lead?.facebook_sender_id) {
          setReplyChannel("facebook");
        } else if (lead?.email) {
          setReplyChannel("email");
        } else if (lead?.facebook_sender_id) {
          setReplyChannel("facebook");
        }
      })
      .catch((err) => console.error("[admin] failed to load messages:", err))
      .finally(() => setMessagesLoading(false));

    setActivitiesLoading(true);
    fetch(`/api/admin/leads/${selectedId}/activities`)
      .then((r) => r.json())
      .then(({ data }) => setActivities(data ?? []))
      .catch((err) => console.error("[admin] failed to load activities:", err))
      .finally(() => setActivitiesLoading(false));
  }, [selectedId]);

  // The conversation thread is visible either in the Inbox (any selected lead)
  // or in the lead detail panel's Messages tab.
  const threadVisible =
    (topTab === "inbox" && !!selectedId) ||
    (topTab === "leads" && activeTab === "messages");

  // Scroll the thread container when messages change.
  // On open / manual refresh / after sending (justLoadedRef): always jump to the newest message.
  // On a passive Realtime update: only scroll if the user is already within 150px of the
  // bottom, so reading older history is not interrupted.
  useEffect(() => {
    if (!threadVisible || messagesLoading || messages.length === 0) return;
    const el = threadRef.current;
    if (!el) return;
    if (justLoadedRef.current) {
      el.scrollTop = el.scrollHeight;
      justLoadedRef.current = false;
    } else {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 150) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages.length, threadVisible, messagesLoading]);

  // Realtime: subscribe to the selected lead's messages and lead row
  useEffect(() => {
    if (!selectedId) return;
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`lead-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `lead_id=eq.${selectedId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev; // dedup
            return [...prev, incoming];
          });
          if (incoming.direction === "inbound") {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === selectedId
                  ? {
                      ...l,
                      has_unread_messages: true,
                      needs_response: true,
                      last_message_at: incoming.created_at,
                      last_message_direction: "inbound",
                    }
                  : l
              )
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leads",
          filter: `id=eq.${selectedId}`,
        },
        (payload) => {
          const updated = payload.new as Lead;
          setLeads((prev) =>
            prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  // Realtime: global leads channel — new leads appear instantly, badge counts stay current
  useEffect(() => {
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel("leads-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const newLead = payload.new as Lead;
          setLeads((prev) => {
            if (prev.some((l) => l.id === newLead.id)) return prev;
            return [newLead, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const updated = payload.new as Lead;
          setLeads((prev) =>
            prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Records a message as the latest for its lead (keeps the newest by created_at)
  function recordLatestMessage(m: Message) {
    if (!m?.lead_id) return;
    setLatestMsgByLead((prev) => {
      const cur = prev[m.lead_id];
      if (cur && new Date(cur.created_at).getTime() > new Date(m.created_at).getTime()) return prev;
      return { ...prev, [m.lead_id]: m };
    });
  }

  // Load the latest message per lead on mount (for Inbox previews), then keep it
  // current with a global realtime subscription on message inserts.
  useEffect(() => {
    fetch("/api/admin/messages/latest")
      .then((r) => r.json())
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, Message> = {};
        for (const m of data as Message[]) map[m.lead_id] = m;
        setLatestMsgByLead(map);
      })
      .catch((err) => console.error("[admin] failed to load latest messages:", err));

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("messages-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => recordLatestMessage(payload.new as Message)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Poll leads list every 60 seconds so unread/needs-response badges stay current
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/leads");
        if (!res.ok) return;
        const { data } = await res.json();
        if (data) setLeads(dedupeLeadsById(data));
      } catch {
        // silent — background poll, never surface errors to the user
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Refresh activities after mutations that create server-side activity records
  function refreshActivities(id: string) {
    fetch(`/api/admin/leads/${id}/activities`)
      .then((r) => r.json())
      .then(({ data }) => setActivities(data ?? []))
      .catch((err) => console.error("[admin] failed to refresh activities:", err));
  }

  // ── Schedule / Calendar ──────────────────────────────────────────────────────

  function fetchScheduleEvents() {
    setScheduleLoading(true);
    fetch("/api/admin/schedule")
      .then((r) => r.json())
      .then(({ data }) => setScheduleEvents(data ?? []))
      .catch((err) => console.error("[admin] failed to load schedule:", err))
      .finally(() => setScheduleLoading(false));
  }

  // Load schedule events once on mount
  useEffect(() => {
    fetchScheduleEvents();
  }, []);

  function openAddEvent(prefillLeadId?: string, prefillDate?: string) {
    const lead = prefillLeadId ? leads.find((l) => l.id === prefillLeadId) : null;
    setEventForm({
      ...emptyEventForm,
      lead_id: prefillLeadId ?? "",
      title: lead ? `Follow up with ${lead.business_name || lead.name}` : "",
      start_date: prefillDate ?? (lead?.follow_up_date ? toDateInputValue(lead.follow_up_date) : ""),
    });
    setLeadQuery(lead ? lead.name : "");
    setShowLeadDropdown(false);
    setEventError(null);
    focusEventStartRef.current = false;
    setShowAddEvent(true);
  }

  // Opens the Add Scheduled Item modal prefilled from a conversation message.
  function openScheduleFromMessage(msg: Message) {
    const lead = leads.find((l) => l.id === msg.lead_id);
    const channelLabel = SOURCE_LABELS[msg.channel as Source] ?? msg.channel;
    setEventForm({
      ...emptyEventForm,
      lead_id: msg.lead_id,
      title: lead ? `Follow up with ${lead.business_name || lead.name}` : "Scheduled item",
      description: `From ${channelLabel} message:\n${msg.body}`,
      event_type: "follow_up",
    });
    setLeadQuery(lead ? lead.name : "");
    setShowLeadDropdown(false);
    setEventError(null);
    focusEventStartRef.current = true;
    setShowAddEvent(true);
  }

  // Focus a sensible field when the Add modal opens
  useEffect(() => {
    if (showAddEvent) {
      const id = setTimeout(() => {
        if (focusEventStartRef.current) addEventStartRef.current?.focus();
        else addEventLeadRef.current?.focus();
      }, 30);
      return () => clearTimeout(id);
    }
  }, [showAddEvent]);

  // Focus the title field when the inline schedule form opens
  useEffect(() => {
    if (showScheduleForm) {
      const id = setTimeout(() => scheduleTitleRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [showScheduleForm]);

  async function handleDeleteEvent(eventId: string) {
    const leadId = scheduleEvents.find((e) => e.id === eventId)?.lead_id ?? null;
    try {
      const res = await fetch(`/api/admin/schedule/${eventId}`, { method: "DELETE" });
      if (res.ok) {
        setScheduleEvents((prev) => prev.filter((e) => e.id !== eventId));
        setSelectedEvent(null);
        setConfirmDeleteEvent(false);
        // Schedule-related timeline entries were removed server-side — refresh if that lead is open
        if (selectedId && leadId === selectedId) refreshActivities(selectedId);
      } else {
        console.error("[admin] delete event failed:", await res.text());
      }
    } catch (err) {
      console.error("[admin] delete event error:", err);
    }
  }

  async function handleSaveEvent(_fromInline: boolean) {
    setEventError(null);
    if (!eventForm.title.trim()) { setEventError("Title is required."); return; }
    if (!eventForm.start_date) { setEventError("Start date is required."); return; }

    const startParsed = parseTime12(eventForm.start_time);
    if (!startParsed) { setEventError("Enter a valid start time, like 9:00."); return; }
    const start24 = to24hFrom12(startParsed, eventForm.start_ampm);
    const startAt = new Date(`${eventForm.start_date}T${start24}`).toISOString();

    // End is optional. Only build it if an end time (or end date) was provided.
    let endAt: string | null = null;
    if (eventForm.end_time.trim()) {
      const endParsed = parseTime12(eventForm.end_time);
      if (!endParsed) { setEventError("Enter a valid end time, like 2:30."); return; }
      const end24 = to24hFrom12(endParsed, eventForm.end_ampm);
      const endDate = eventForm.end_date || eventForm.start_date;
      endAt = new Date(`${endDate}T${end24}`).toISOString();
      if (new Date(endAt) < new Date(startAt)) {
        setEventError("End time is before the start time.");
        return;
      }
    } else if (eventForm.end_date) {
      endAt = new Date(`${eventForm.end_date}T${start24}`).toISOString();
    }

    setEventSaving(true);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: eventForm.lead_id || null,
          title: eventForm.title.trim(),
          event_type: eventForm.event_type,
          start_at: startAt,
          end_at: endAt,
          description: eventForm.description.trim() || null,
          status: eventForm.status,
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setScheduleEvents((prev) => [...prev, data].sort(
          (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
        ));
        if (eventForm.lead_id) refreshActivities(eventForm.lead_id);
        setShowAddEvent(false);
        setShowScheduleForm(false);
        setEventForm(emptyEventForm);
        setLeadQuery("");
        setEventError(null);
      } else {
        setEventError("Couldn't save the item. Please try again.");
        console.error("[admin] save event failed:", await res.text());
      }
    } catch (err) {
      console.error("[admin] save event error:", err);
      setEventError("Couldn't save the item. Please try again.");
    } finally {
      setEventSaving(false);
    }
  }

  async function handleEventStatus(eventId: string, status: string) {
    try {
      const res = await fetch(`/api/admin/schedule/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setScheduleEvents((prev) => prev.map((e) => (e.id === eventId ? data : e)));
        setSelectedEvent((cur) => (cur && cur.eventId === eventId ? { ...cur, status } : cur));
        // Completing logs a timeline activity server-side — refresh if that lead is open
        if (status === "completed" && selectedId && data?.lead_id === selectedId) {
          refreshActivities(selectedId);
        }
      }
    } catch (err) {
      console.error("[admin] update event status error:", err);
    }
  }

  // Converts a ScheduleEvent into the CalItem shape used by the event detail modal,
  // so the lead Overview list can open the same modal (with complete/delete/.ics).
  function scheduleEventToCalItem(ev: ScheduleEvent): CalItem {
    return {
      key: `event-${ev.id}`,
      kind: "event",
      eventId: ev.id,
      leadId: ev.lead_id,
      title: ev.title,
      eventType: ev.event_type,
      startAt: ev.start_at,
      endAt: ev.end_at,
      description: ev.description,
      status: ev.status,
      leadName: ev.lead?.name ?? "—",
      leadEmail: ev.lead?.email ?? null,
      leadPhone: ev.lead?.phone ?? null,
      leadSource: ev.lead?.source ?? null,
    };
  }

  async function handleRefreshMessages() {
    if (!selectedId) return;
    setMessagesRefreshing(true);
    try {
      const [msgsRes, activRes, leadsRes] = await Promise.all([
        fetch(`/api/admin/leads/${selectedId}/messages`),
        fetch(`/api/admin/leads/${selectedId}/activities`),
        fetch("/api/admin/leads"),
      ]);
      const [msgsJson, activJson, leadsJson] = await Promise.all([
        msgsRes.json(),
        activRes.json(),
        leadsRes.json(),
      ]);
      if (msgsJson.data) { justLoadedRef.current = true; setMessages(msgsJson.data); }
      if (activJson.data) setActivities(activJson.data);
      if (leadsJson.data) setLeads(dedupeLeadsById(leadsJson.data));
    } catch (err) {
      console.error("[admin] refresh messages error:", err);
    } finally {
      setMessagesRefreshing(false);
    }
  }

  // Overview stats
  const stats = useMemo(() => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return {
      total: leads.length,
      new: leads.filter((l) => l.status === "new").length,
      needsResponse: leads.filter((l) => l.needs_response).length,
      followUpDue: leads.filter(
        (l) => l.follow_up_date && new Date(l.follow_up_date) <= todayEnd
      ).length,
    };
  }, [leads]);

  // Filtered + sorted leads
  const filteredLeads = useMemo(() => {
    let out = dedupeLeadsById(leads); // final guard against duplicate React keys
    if (statusFilter !== "all") out = out.filter((l) => l.status === statusFilter);
    if (urgencyFilter !== "all") out = out.filter((l) => l.urgency === urgencyFilter);
    if (needsResponseFilter) out = out.filter((l) => l.needs_response);
    if (followUpDueFilter) out = out.filter((l) => l.follow_up_date && isFollowUpOverdue(l.follow_up_date));
    out.sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "desc" ? -diff : diff;
    });
    return out;
  }, [leads, statusFilter, urgencyFilter, sortDir, needsResponseFilter, followUpDueFilter]);

  // Active stat-filter derived from the underlying filter states (kept in sync with
  // the status dropdown / Needs response button so there are no stale highlights).
  // "none" when a different manual filter (e.g. a non-New status) is applied.
  const activeStat: "all" | "new" | "needs" | "due" | "none" =
    needsResponseFilter ? "needs"
    : followUpDueFilter ? "due"
    : statusFilter === "new" ? "new"
    : statusFilter === "all" ? "all"
    : "none";

  // Stat cards/chips apply one quick filter at a time. Clicking the active one clears it.
  function applyStatFilter(kind: "all" | "new" | "needs" | "due") {
    const isActive = activeStat === kind && kind !== "all";
    setNeedsResponseFilter(kind === "needs" && !isActive);
    setFollowUpDueFilter(kind === "due" && !isActive);
    setStatusFilter(kind === "new" && !isActive ? "new" : "all");
  }

  // Primary conversation channel for a lead (drives the channel badge + reply default)
  function leadChannel(lead: Lead): "facebook" | "email" | string {
    if (lead.facebook_sender_id) return "facebook";
    if (lead.email) return "email";
    return lead.source ?? "other";
  }

  // Conversations = leads with at least one logged message (last_message_at set),
  // filtered + sorted for the Inbox.
  const conversations = useMemo(() => {
    let out = leads.filter((l) => l.last_message_at);

    if (inboxFilter === "needs_response") out = out.filter((l) => l.needs_response);
    else if (inboxFilter === "unread") out = out.filter((l) => l.has_unread_messages);
    else if (inboxFilter === "email") out = out.filter((l) => !l.facebook_sender_id && !!l.email);
    else if (inboxFilter === "facebook") out = out.filter((l) => !!l.facebook_sender_id);

    out.sort((a, b) => {
      // Needs-response first
      if (a.needs_response !== b.needs_response) return a.needs_response ? -1 : 1;
      // Then newest activity
      const at = new Date(a.last_message_at ?? a.created_at).getTime();
      const bt = new Date(b.last_message_at ?? b.created_at).getTime();
      return bt - at;
    });
    return out;
  }, [leads, inboxFilter]);

  // Total unread inbound messages across all leads (sum, not lead count)
  const totalUnread = useMemo(
    () => leads.reduce((sum, l) => sum + (l.unread_count ?? 0), 0),
    [leads]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function patchLead(
    id: string,
    updates: Partial<Lead>,
    extra?: Record<string, unknown>
  ): Promise<boolean> {
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, ...extra }),
    });
    if (!res.ok) {
      console.error("[admin] patch failed:", await res.text());
      return false;
    }
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    return true;
  }

  async function handleStatusChange(id: string, status: string) {
    const prevStatus = selectedLead?.status;
    const ok = await patchLead(
      id,
      { status: status as Lead["status"] },
      { _prev_status: prevStatus }
    );
    if (ok) refreshActivities(id);
  }

  async function handleUrgencyChange(id: string, urgency: string) {
    const prevUrgency = selectedLead?.urgency;
    if (prevUrgency === urgency) return;
    const ok = await patchLead(
      id,
      { urgency: urgency as Lead["urgency"] },
      { _prev_urgency: prevUrgency }
    );
    if (ok) refreshActivities(id);
  }

  // ── Prospecting ───────────────────────────────────────────────────────────────

  async function handleFitScore(id: string, score: number) {
    const prev = selectedLead?.fit_score ?? null;
    const next = prev === score ? null : score; // click same number to clear
    const ok = await patchLead(id, { fit_score: next }, { _prev_fit_score: prev });
    if (ok) refreshActivities(id);
  }

  async function handleOutreachStatus(id: string, status: string) {
    const prev = selectedLead?.outreach_status ?? null;
    if (prev === status) return;
    const ok = await patchLead(id, { outreach_status: status }, { _prev_outreach_status: prev });
    if (ok) refreshActivities(id);
  }

  function handleChecklistToggle(id: string, key: string) {
    const current = selectedLead?.prospect_checklist ?? {};
    const next = { ...current, [key]: !current[key] };
    if (!next[key]) delete next[key]; // keep the object tidy
    patchLead(id, { prospect_checklist: next });
  }

  function openScheduleFollowUp() {
    if (!selectedLead) return;
    setEventForm({
      ...emptyEventForm,
      lead_id: selectedLead.id,
      title: `Follow up with ${selectedLead.business_name || selectedLead.name}`,
      event_type: "follow_up",
      description: "Prospect follow-up",
      start_date: selectedLead.follow_up_date ? toDateInputValue(selectedLead.follow_up_date) : "",
    });
    setEventError(null);
    setShowScheduleForm(true);
  }

  async function handleLogOutreach() {
    if (!selectedId || !outreachDraft.body.trim()) return;
    setOutreachSaving(true);
    try {
      // 1) Save the outreach as an outbound message
      const res = await fetch(`/api/admin/leads/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: outreachDraft.channel, direction: "outbound", body: outreachDraft.body.trim() }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setMessages((prev) => [...prev, data]);
        recordLatestMessage(data);
      }
      // 2) Update outreach_status (separate from pipeline status)
      await patchLead(selectedId, { outreach_status: outreachDraft.outreachStatus });
      // 3) Log an outreach activity
      await fetch(`/api/admin/leads/${selectedId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "outreach_logged", label: `Outreach logged — ${OUTREACH_STATUS_LABELS[outreachDraft.outreachStatus as OutreachStatus] ?? "Outreach sent"}`, metadata: { channel: outreachDraft.channel, outreach_status: outreachDraft.outreachStatus } }),
      });
      // Logging outreach never changes the pipeline status — only outreach_status.
      refreshActivities(selectedId);
      const wantsFollowUp = outreachDraft.scheduleFollowUp;
      setOutreachDraft({ channel: "facebook", body: "", outreachStatus: "outreach_sent", scheduleFollowUp: false });
      setShowOutreach(false);
      // 4) Optionally open the schedule follow-up flow
      if (wantsFollowUp) openScheduleFollowUp();
    } catch (err) {
      console.error("[admin] log outreach error:", err);
    } finally {
      setOutreachSaving(false);
    }
  }

  async function handleHelpNeeded(value: string) {
    if (!selectedId) return;
    const v = value.trim();
    setHelpDraft(v);
    setEditingHelp(false);
    const ok = await patchLead(selectedId, { help_needed: v || null }, { _prev_help_needed: selectedLead?.help_needed ?? null });
    if (ok) refreshActivities(selectedId);
  }

  function handleCopyOutreach() {
    if (!selectedLead) return;
    const who = selectedLead.business_name || selectedLead.name || "there";
    const template = `Hi ${who}, I came across your business and wanted to reach out — I help local businesses tidy up their website, online booking, and Google presence so more inquiries turn into jobs. Would you be open to a quick chat?`;
    navigator.clipboard?.writeText(template).then(
      () => { setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); },
      () => {}
    );
  }

  // Promotes a prospect into the normal pipeline (status New). Prospecting data
  // is preserved; the panel hides because the status is no longer prospect/contacted.
  async function handleConvertToLead() {
    if (!selectedId) return;
    const ok = await patchLead(selectedId, { status: "new" }, { _prev_status: selectedLead?.status });
    if (ok) {
      await fetch(`/api/admin/leads/${selectedId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "prospect_converted", label: "Prospect converted to lead" }),
      });
      refreshActivities(selectedId);
    }
  }

  async function handleMarkNotAFit() {
    if (!selectedId) return;
    const ok = await patchLead(
      selectedId,
      { status: "not_a_fit", outreach_status: "bad_fit" },
      { _prev_status: selectedLead?.status }
    );
    if (ok) {
      await fetch(`/api/admin/leads/${selectedId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "prospect_disqualified", label: "Prospect marked not a fit" }),
      });
      refreshActivities(selectedId);
    }
  }

  async function handleFollowUpChange(id: string, dateValue: string) {
    const ok = await patchLead(id, { follow_up_date: dateValue || null });
    if (ok) refreshActivities(id);
  }

  async function handleSaveNote() {
    if (!selectedId || !noteDraft.trim()) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${selectedId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteDraft.trim() }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setNoteHistory((prev) => [data, ...prev]);
        setNoteDraft("");
        refreshActivities(selectedId);
      } else {
        console.error("[admin] save note failed:", await res.text());
      }
    } catch (err) {
      console.error("[admin] save note error:", err);
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleSaveMessage() {
    if (!selectedId || !messageDraft.body.trim()) return;
    setMessageSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: messageDraft.channel,
          direction: messageDraft.direction,
          body: messageDraft.body.trim(),
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        justLoadedRef.current = true; // force scroll to the message we just logged
        setMessages((prev) => [...prev, data]);
        recordLatestMessage(data);
        setMessageDraft({ channel: "manual", direction: "inbound", body: "" });
        refreshActivities(selectedId);
        const loggedAt = new Date().toISOString();
        const loggedDir = messageDraft.direction;
        setLeads((prev) =>
          prev.map((l) => {
            if (l.id !== selectedId) return l;
            return {
              ...l,
              last_message_at: loggedAt,
              last_message_direction: loggedDir,
              has_unread_messages: loggedDir === "inbound" ? true : loggedDir === "outbound" ? false : l.has_unread_messages,
              needs_response: loggedDir === "inbound" ? true : loggedDir === "outbound" ? false : l.needs_response,
              unread_count: loggedDir === "inbound" ? (l.unread_count ?? 0) + 1 : loggedDir === "outbound" ? 0 : l.unread_count,
            };
          })
        );
      } else {
        console.error("[admin] save message failed:", await res.text());
      }
    } catch (err) {
      console.error("[admin] save message error:", err);
    } finally {
      setMessageSaving(false);
    }
  }

  async function handleCalendarExport() {
    if (!selectedLead) return;
    downloadIcs(selectedLead);
    try {
      const res = await fetch(`/api/admin/leads/${selectedLead.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "calendar_exported",
          label: "Follow-up calendar event exported",
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setActivities((prev) => [data, ...prev]);
      }
    } catch (err) {
      console.error("[admin] calendar export activity error:", err);
    }
  }

  async function handleSendReply() {
    if (!selectedId || !emailDraft.body.trim()) return;
    if (replyChannel === "email" && !emailDraft.subject.trim()) return;
    setEmailSending(true);
    setEmailFeedback(null);
    try {
      const res = await fetch(`/api/admin/leads/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: replyChannel,
          subject: emailDraft.subject.trim(),
          body: emailDraft.body.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setEmailDraft((d) => ({ ...d, body: "" }));
        justLoadedRef.current = true; // force scroll to the message we just sent
        if (json.message) { setMessages((prev) => [...prev, json.message]); recordLatestMessage(json.message); }
        if (json.activity) setActivities((prev) => [json.activity, ...prev]);
        setEmailFeedback({ type: "success", text: "Reply sent." });
        const sentAt = new Date().toISOString();
        setLeads((prev) =>
          prev.map((l) =>
            l.id === selectedId
              ? { ...l, last_message_at: sentAt, last_message_direction: "outbound", has_unread_messages: false, needs_response: false, unread_count: 0 }
              : l
          )
        );
      } else {
        setEmailFeedback({ type: "error", text: json.error ?? "Failed to send reply." });
      }
    } catch (err) {
      console.error("[admin] send reply error:", err);
      setEmailFeedback({ type: "error", text: "Failed to send reply. Try again." });
    } finally {
      setEmailSending(false);
    }
  }

  async function handleAddLead() {
    if (!addLeadForm.name.trim() || !addLeadForm.email.trim()) return;
    setAddLeadSaving(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addLeadForm),
      });
      if (res.ok) {
        const { data } = await res.json();
        setLeads((prev) => dedupeLeadsById([data, ...prev]));
        setShowAddLead(false);
        setAddLeadForm({
          name: "",
          business_name: "",
          email: "",
          phone: "",
          website_url: "",
          facebook_url: "",
          business_type: "",
          help_needed: "",
          message: "",
          source: "manual",
          urgency: "normal",
          status: "new",
        });
      } else {
        console.error("[admin] create lead failed:", await res.text());
      }
    } catch (err) {
      console.error("[admin] create lead error:", err);
    } finally {
      setAddLeadSaving(false);
    }
  }

  async function handleDeleteLead() {
    if (!selectedId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/leads/${selectedId}`, { method: "DELETE" });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== selectedId));
        setSelectedId(null);
        setShowDeleteConfirm(false);
      } else {
        const json = await res.json().catch(() => ({}));
        setDeleteError((json as { error?: string }).error ?? "Failed to delete lead. Try again.");
      }
    } catch {
      setDeleteError("Failed to delete lead. Try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAddMessageAsNote(msgId: string, noteText: string) {
    if (!selectedId) return;
    setSavingNoteForMsgId(msgId);
    try {
      const res = await fetch(`/api/admin/leads/${selectedId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setNoteHistory((prev) => [data, ...prev]);
        setAddedNoteForMsgId(msgId);
        setTimeout(() => setAddedNoteForMsgId((cur) => (cur === msgId ? null : cur)), 2000);
        refreshActivities(selectedId);
      }
    } catch (err) {
      console.error("[admin] add message as note error:", err);
    } finally {
      setSavingNoteForMsgId((cur) => (cur === msgId ? null : cur));
    }
  }

  function handleEditDetails() {
    if (!selectedLead) return;
    const links = effectiveLinks(selectedLead);
    setEditDraft({
      name: selectedLead.name ?? "",
      business_name: selectedLead.business_name ?? "",
      email: selectedLead.email ?? "",
      phone: selectedLead.phone ?? "",
      website_url: links.website ?? "",
      facebook_url: links.facebook ?? "",
      business_type: selectedLead.business_type ?? "",
      help_needed: selectedLead.help_needed ?? "",
      message: selectedLead.message ?? "",
      urgency: selectedLead.urgency,
    });
    setEditFeedback(null);
    setIsEditingDetails(true);
  }

  async function handleSaveDetails() {
    if (!selectedId || !editDraft.name.trim()) return;
    setEditSaving(true);
    setEditFeedback(null);
    try {
      // Writes the typed fields and clears the legacy combined field, migrating the
      // lead's link data into website_url / facebook_url as it's edited.
      const saved = {
        name: editDraft.name.trim(),
        business_name: editDraft.business_name.trim(),
        email: editDraft.email.trim() || null,
        phone: editDraft.phone.trim() || null,
        website_url: editDraft.website_url.trim() || null,
        facebook_url: editDraft.facebook_url.trim() || null,
        website_or_facebook: null,
        business_type: editDraft.business_type.trim() || null,
        help_needed: editDraft.help_needed.trim() || null,
        message: editDraft.message.trim() || null,
        urgency: editDraft.urgency,
      };
      const res = await fetch(`/api/admin/leads/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saved),
      });
      if (res.ok) {
        setLeads((prev) => prev.map((l) => l.id === selectedId ? { ...l, ...saved } : l));
        setIsEditingDetails(false);
        setEditFeedback({ type: "success", text: "Lead updated." });
        setTimeout(() => setEditFeedback(null), 3000);
      } else {
        const json = await res.json().catch(() => ({}));
        setEditFeedback({ type: "error", text: (json as { error?: string }).error ?? "Failed to save. Try again." });
      }
    } catch {
      setEditFeedback({ type: "error", text: "Failed to save. Try again." });
    } finally {
      setEditSaving(false);
    }
  }

  async function handleMarkAsRead() {
    if (!selectedId) return;
    await patchLead(selectedId, { has_unread_messages: false, unread_count: 0 });
  }

  async function handleMarkAsHandled() {
    if (!selectedId) return;
    await patchLead(selectedId, { has_unread_messages: false, needs_response: false, unread_count: 0 });
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin";
  }

  // ── Tab content renderers ──────────────────────────────────────────────────

  function renderOverviewTab() {
    if (!selectedLead) return null;
    return (
      <div className="space-y-6">
        {/* Status + urgency */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1.5">
              Status
            </label>
            <select
              value={selectedLead.status}
              onChange={(e) => handleStatusChange(selectedLead.id, e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1.5">
              Urgency
            </label>
            <select
              value={selectedLead.urgency}
              onChange={(e) => handleUrgencyChange(selectedLead.id, e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="normal">Normal</option>
              <option value="priority">Priority</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </div>

        {/* Prospecting panel — only while the lead is a Prospect or Contacted */}
        {PROSPECTING_STATUSES.has(selectedLead.status) && (
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-3">
            {/* Header: title + summary (collapsed) + toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setProspectCollapsed((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 uppercase tracking-widest"
              >
                <span className={`text-[10px] transition-transform ${prospectCollapsed ? "" : "rotate-90"}`}>▶</span>
                Prospecting
              </button>
              {prospectCollapsed && (
                <span className="text-[11px] text-slate-500 truncate">
                  Fit: {selectedLead.fit_score ?? "–"}/5 · {OUTREACH_STATUS_LABELS[(selectedLead.outreach_status ?? "not_contacted") as OutreachStatus]} · Checklist: {Object.keys(selectedLead.prospect_checklist ?? {}).length}/{PROSPECT_CHECKLIST.length}
                </span>
              )}
            </div>

            {/* Quick actions — always visible */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowOutreach((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors duration-150"
              >
                <Send size={11} /> Log outreach
              </button>
              <button
                onClick={openScheduleFollowUp}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-violet-600 bg-white border border-slate-200 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-colors duration-150"
              >
                <Clock size={11} /> Schedule follow-up
              </button>
              <button
                onClick={handleCopyOutreach}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-violet-600 bg-white border border-slate-200 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-colors duration-150"
              >
                {copyFeedback ? "✓ Copied" : "Copy outreach message"}
              </button>
            </div>

            {/* Log outreach inline form — available even when collapsed */}
            {showOutreach && (
              <div className="space-y-2 bg-white border border-violet-100 rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={outreachDraft.channel}
                    onChange={(e) => setOutreachDraft((d) => ({ ...d, channel: e.target.value }))}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-violet-400"
                  >
                    {["facebook", "email", "phone", "manual", "other"].map((c) => (
                      <option key={c} value={c}>{SOURCE_LABELS[c as Source] ?? c}</option>
                    ))}
                  </select>
                  <select
                    value={outreachDraft.outreachStatus}
                    onChange={(e) => setOutreachDraft((d) => ({ ...d, outreachStatus: e.target.value }))}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-violet-400"
                    title="Outreach status after this"
                  >
                    {OUTREACH_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{OUTREACH_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input type="checkbox" checked={outreachDraft.scheduleFollowUp} onChange={(e) => setOutreachDraft((d) => ({ ...d, scheduleFollowUp: e.target.checked }))} />
                    + Follow-up
                  </label>
                </div>
                <textarea
                  value={outreachDraft.body}
                  onChange={(e) => setOutreachDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={3}
                  placeholder="What did you send? e.g. Messaged on Facebook about a website refresh."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-violet-400 resize-none leading-relaxed"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowOutreach(false)} className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors duration-150">Cancel</button>
                  <button
                    onClick={handleLogOutreach}
                    disabled={outreachSaving || !outreachDraft.body.trim()}
                    className="text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {outreachSaving ? "Saving…" : "Save outreach"}
                  </button>
                </div>
              </div>
            )}

            {/* Expanded controls */}
            {!prospectCollapsed && (
              <div className="space-y-4 pt-1">
                {/* Likely need / Help needed */}
                <div>
                  <div className="text-xs text-slate-500 mb-1.5">Likely need / Help needed</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {HELP_CHIPS.map((chip) => {
                      const active = (selectedLead.help_needed ?? "").toLowerCase() === chip.toLowerCase();
                      return (
                        <button
                          key={chip}
                          onClick={() => handleHelpNeeded(chip)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors duration-150 ${
                            active ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:border-violet-400"
                          }`}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={helpDraft}
                      onChange={(e) => { setHelpDraft(e.target.value); setEditingHelp(true); }}
                      placeholder="Custom need…"
                      className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-violet-400"
                    />
                    {editingHelp && helpDraft.trim() !== (selectedLead.help_needed ?? "").trim() && (
                      <button
                        onClick={() => handleHelpNeeded(helpDraft)}
                        className="shrink-0 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg transition-colors duration-150"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>

                {/* Fit score */}
                <div>
                  <div className="text-xs text-slate-500 mb-1.5">Fit score</div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (selectedLead.fit_score ?? 0) >= n;
                      return (
                        <button
                          key={n}
                          onClick={() => handleFitScore(selectedLead.id, n)}
                          className={`w-7 h-7 rounded-lg text-sm font-semibold border transition-colors duration-150 ${
                            active ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-400 border-slate-200 hover:border-violet-300"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                    {selectedLead.fit_score && (
                      <span className="text-xs text-slate-400 ml-1">tap again to clear</span>
                    )}
                  </div>
                </div>

                {/* Outreach status */}
                <div>
                  <div className="text-xs text-slate-500 mb-1.5">Outreach status</div>
                  <select
                    value={selectedLead.outreach_status ?? "not_contacted"}
                    onChange={(e) => handleOutreachStatus(selectedLead.id, e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-violet-400"
                  >
                    {OUTREACH_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{OUTREACH_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                {/* Qualification checklist */}
                <div>
                  <div className="text-xs text-slate-500 mb-1.5">Qualification</div>
                  <div className="grid grid-cols-1 gap-1">
                    {PROSPECT_CHECKLIST.map(({ key, label }) => {
                      const checked = !!selectedLead.prospect_checklist?.[key];
                      return (
                        <label key={key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none py-0.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleChecklistToggle(selectedLead.id, key)}
                            className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Convert / disqualify */}
                <div className="flex items-center gap-3 pt-1 border-t border-violet-100">
                  <button
                    onClick={handleConvertToLead}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors duration-150"
                  >
                    <ArrowRight size={11} /> Convert to lead
                  </button>
                  <button
                    onClick={handleMarkNotAFit}
                    className="mt-2 text-xs font-medium text-slate-400 hover:text-red-500 transition-colors duration-150"
                  >
                    Mark not a fit
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Follow-up date */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1.5">
            Follow-up date
          </label>
          <input
            type="date"
            value={toDateInputValue(selectedLead.follow_up_date)}
            onChange={(e) => handleFollowUpChange(selectedLead.id, e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {selectedLead.follow_up_date && (
              <button
                onClick={handleCalendarExport}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors duration-150"
              >
                <Calendar size={12} />
                Add follow-up to calendar
              </button>
            )}
            <button
              onClick={() => {
                if (!showScheduleForm) {
                  setEventForm({
                    ...emptyEventForm,
                    lead_id: selectedLead.id,
                    title: `Follow up with ${selectedLead.business_name || selectedLead.name}`,
                    start_date: selectedLead.follow_up_date ? toDateInputValue(selectedLead.follow_up_date) : "",
                  });
                  setEventError(null);
                }
                setShowScheduleForm((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors duration-150"
            >
              <Clock size={12} />
              Schedule item
            </button>
          </div>

          {/* Inline schedule form */}
          {showScheduleForm && (
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <input
                ref={scheduleTitleRef}
                type="text"
                value={eventForm.title}
                onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
              />
              <div className="flex gap-2">
                <select
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm((f) => ({ ...f, event_type: e.target.value }))}
                  className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                >
                  {Object.entries(EVENT_TYPE_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
                <input type="date" value={eventForm.start_date} onChange={(e) => setEventForm((f) => ({ ...f, start_date: e.target.value }))} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-10 shrink-0">Time</span>
                <TimeField
                  time={eventForm.start_time}
                  ampm={eventForm.start_ampm}
                  onTimeChange={(v) => { setEventForm((f) => ({ ...f, start_time: v })); setEventError(null); }}
                  onAmpmChange={(v) => setEventForm((f) => ({ ...f, start_ampm: v }))}
                />
              </div>
              {eventError && (
                <p className="text-xs text-red-600 font-medium">{eventError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowScheduleForm(false)} className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors duration-150">Cancel</button>
                <button
                  onClick={() => handleSaveEvent(true)}
                  disabled={eventSaving || !eventForm.title.trim() || !eventForm.start_date}
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {eventSaving ? "Saving…" : "Save item"}
                </button>
              </div>
            </div>
          )}

          {/* Scheduled items for this lead */}
          {(() => {
            const leadEvents = scheduleEvents
              .filter((e) => e.lead_id === selectedLead.id)
              .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
            if (leadEvents.length === 0) return null;
            return (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Scheduled items</div>
                <div className="space-y-1.5">
                  {leadEvents.map((ev) => {
                    const t = new Date(ev.start_at);
                    const when = t.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                      + " · " + t.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
                    return (
                      <button
                        key={ev.id}
                        onClick={() => { setSelectedEvent(scheduleEventToCalItem(ev)); setEventOpenedFrom("lead"); setConfirmDeleteEvent(false); }}
                        className={`w-full text-left flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2 hover:border-slate-300 transition-colors duration-150 ${
                          ev.status === "completed" || ev.status === "cancelled" ? "opacity-50" : ""
                        }`}
                      >
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${EVENT_TYPE_COLORS[ev.event_type] ?? "bg-gray-100 text-gray-600"}`}>
                          {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                        </span>
                        <span className={`text-sm text-slate-700 flex-1 min-w-0 truncate ${ev.status === "completed" ? "line-through" : ""}`}>{ev.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{when}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Edit feedback banner (success after save) */}
        {editFeedback && !isEditingDetails && (
          <div className={`text-xs font-medium px-3 py-2 rounded-lg border ${
            editFeedback.type === "success"
              ? "bg-green-50 border-green-100 text-green-700"
              : "bg-red-50 border-red-100 text-red-600"
          }`}>
            {editFeedback.text}
          </div>
        )}

        {isEditingDetails ? (
          /* ── Edit mode ── */
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
              Edit details
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Business name</label>
                <input
                  type="text"
                  value={editDraft.business_name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, business_name: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={editDraft.email}
                  onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Phone</label>
                <input
                  type="tel"
                  value={editDraft.phone}
                  onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Business type</label>
                <input
                  type="text"
                  value={editDraft.business_type}
                  onChange={(e) => setEditDraft((d) => ({ ...d, business_type: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Urgency</label>
                <select
                  value={editDraft.urgency}
                  onChange={(e) => setEditDraft((d) => ({ ...d, urgency: e.target.value as "emergency" | "priority" | "normal" }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                >
                  <option value="normal">Normal</option>
                  <option value="priority">Priority</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Website</label>
              <input
                type="text"
                value={editDraft.website_url}
                onChange={(e) => setEditDraft((d) => ({ ...d, website_url: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Facebook</label>
              <input
                type="text"
                value={editDraft.facebook_url}
                onChange={(e) => setEditDraft((d) => ({ ...d, facebook_url: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Service / Help needed</label>
              <input
                type="text"
                value={editDraft.help_needed}
                onChange={(e) => setEditDraft((d) => ({ ...d, help_needed: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Message / Request</label>
              <textarea
                value={editDraft.message}
                onChange={(e) => setEditDraft((d) => ({ ...d, message: e.target.value }))}
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400 resize-none leading-relaxed"
              />
            </div>

            {editFeedback?.type === "error" && (
              <p className="text-xs text-red-600 font-medium">{editFeedback.text}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSaveDetails}
                disabled={editSaving || !editDraft.name.trim()}
                className="text-xs font-semibold bg-[#0f1c40] hover:bg-[#1a2d5a] text-white px-3 py-1.5 rounded-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => { setIsEditingDetails(false); setEditFeedback(null); }}
                disabled={editSaving}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors duration-150"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <>
            {/* Contact info */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Contact
                </div>
                <button
                  onClick={handleEditDetails}
                  className="text-xs font-medium text-slate-400 hover:text-blue-600 transition-colors duration-150"
                >
                  Edit details
                </button>
              </div>
              <div className="space-y-3">
                <InfoRow
                  label="Email"
                  value={
                    selectedLead.email ? (
                      <a href={`mailto:${selectedLead.email}`} className="text-blue-600 hover:underline">
                        {selectedLead.email}
                      </a>
                    ) : "—"
                  }
                  action={
                    selectedLead.email ? (
                      <a
                        href={`mailto:${selectedLead.email}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-2 py-1 rounded-lg transition-colors duration-150"
                      >
                        <Mail size={11} />
                        Email
                      </a>
                    ) : undefined
                  }
                />
                <InfoRow
                  label="Phone"
                  value={
                    selectedLead.phone ? (
                      <a href={`tel:${cleanPhone(selectedLead.phone)}`} className="text-slate-700 hover:text-blue-600 transition-colors duration-150">
                        {selectedLead.phone}
                      </a>
                    ) : "—"
                  }
                  action={
                    selectedLead.phone ? (
                      <a
                        href={`tel:${cleanPhone(selectedLead.phone)}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-2 py-1 rounded-lg transition-colors duration-150"
                      >
                        <Phone size={11} />
                        Call
                      </a>
                    ) : undefined
                  }
                />
                {(() => {
                  const links = effectiveLinks(selectedLead);
                  const linkVal = (u: string | null) =>
                    u ? (
                      <a href={hrefFor(u)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{u}</a>
                    ) : "—";
                  return (
                    <>
                      <InfoRow label="Website" value={linkVal(links.website)} />
                      <InfoRow label="Facebook" value={linkVal(links.facebook)} />
                      <InfoRow
                        label="Messenger"
                        value={
                          selectedLead.facebook_sender_id ? (
                            <span className="text-teal-600 font-medium">Connected</span>
                          ) : (selectedLead.source === "facebook" || links.facebook) ? (
                            <span className="text-amber-600 font-medium">Not connected</span>
                          ) : "—"
                        }
                      />
                    </>
                  );
                })()}
                <InfoRow label="Business type" value={selectedLead.business_type || "—"} />
              </div>
            </div>

            {/* Request details */}
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Request
              </div>
              <div className="space-y-3">
                <InfoRow label="Help needed" value={selectedLead.help_needed || "—"} />
                <InfoRow label="Submitted" value={formatDate(selectedLead.created_at)} />
                {selectedLead.updated_at && (
                  <InfoRow label="Updated" value={formatDate(selectedLead.updated_at)} />
                )}
                {selectedLead.follow_up_date && (
                  <InfoRow
                    label="Follow-up"
                    value={
                      <span className={isFollowUpOverdue(selectedLead.follow_up_date) ? "text-amber-600 font-medium" : undefined}>
                        {formatDate(selectedLead.follow_up_date)}
                        {isFollowUpOverdue(selectedLead.follow_up_date) && " · due"}
                      </span>
                    }
                  />
                )}
              </div>
              {selectedLead.message && (
                <div className="mt-4">
                  <div className="text-xs text-slate-400 mb-1.5">Original message</div>
                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-wrap">
                    {selectedLead.message}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Danger zone */}
        <div className="border-t border-slate-100 pt-5">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors duration-150"
            >
              Delete lead
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm text-red-800 leading-relaxed">
                Delete <span className="font-semibold">{selectedLead.name}</span> and all related messages, notes, and activity history? This cannot be undone.
              </p>
              {deleteError && (
                <p className="text-xs text-red-600 font-medium">{deleteError}</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeleteLead}
                  disabled={isDeleting}
                  className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? "Deleting…" : "Yes, delete lead"}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                  disabled={isDeleting}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors duration-150 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderMessagesTab() {
    function getChannelLabel(channel: string): string {
      const map: Record<string, string> = {
        website: "Website", facebook: "Facebook", phone: "Phone",
        text: "Text", email: "Email", referral: "Referral",
        manual: "Manual Entry", other: "Other",
      };
      return map[channel] ?? channel;
    }

    function getSenderLabel(msg: Message): string {
      const ch = getChannelLabel(msg.channel);
      if (msg.direction === "outbound") return `Onward Systems via ${ch}`;
      if (msg.direction === "internal") return "Internal note";
      const name = selectedLead?.name || selectedLead?.email || "Customer";
      return `${name} via ${ch}`;
    }

    const hasAlert = selectedLead?.has_unread_messages || selectedLead?.needs_response;

    return (
      <div className="flex-1 min-h-0 flex flex-col">

        {/* ── A: Action bar — status on its own line on mobile, buttons wrap below ── */}
        <div className="shrink-0 flex items-center gap-2 flex-wrap px-4 md:px-5 py-2 border-b border-slate-100 bg-white">
          {hasAlert && (
            <>
              <div className="flex items-center gap-1.5 w-full md:w-auto md:flex-1 min-w-0">
                <Bell size={12} className="text-teal-600 shrink-0" />
                <span className="text-xs text-teal-700 truncate">
                  {selectedLead?.has_unread_messages ? "Unread message" : "Needs response"}
                </span>
              </div>
              {selectedLead?.has_unread_messages && (
                <button
                  onClick={handleMarkAsRead}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-1 rounded-lg transition-colors duration-150"
                >
                  <CheckCheck size={10} />
                  Mark as read
                </button>
              )}
              {selectedLead?.needs_response && (
                <button
                  onClick={handleMarkAsHandled}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg transition-colors duration-150"
                >
                  Mark as handled
                </button>
              )}
            </>
          )}
          <button
            onClick={handleRefreshMessages}
            disabled={messagesRefreshing || messagesLoading}
            className={`shrink-0 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 disabled:opacity-40 transition-colors duration-150 ${!hasAlert ? "ml-auto" : ""}`}
          >
            <RefreshCw size={10} className={messagesRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── B: Conversation thread — fills all remaining height ── */}
        <div
          ref={threadRef}
          className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-3 md:px-5 py-3 md:py-4"
        >
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-slate-400">Loading messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full px-4">
              <p className="text-xs text-slate-400 italic text-center leading-relaxed">
                No messages yet. Website forms, email replies, and manually logged conversations will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isOutbound = msg.direction === "outbound";
                const isInternal = msg.direction === "internal";
                const sender = getSenderLabel(msg);
                const ch = getChannelLabel(msg.channel);
                const chColor = SOURCE_COLORS[msg.channel as Source] ?? "bg-gray-100 text-gray-600";

                const isSavingNote = savingNoteForMsgId === msg.id;
                const isNoteAdded  = addedNoteForMsgId  === msg.id;
                const noteText     = `${sender}:\n${msg.body}`;

                if (isInternal) {
                  return (
                    <div key={msg.id} className="group flex flex-col items-center px-2">
                      <p className="text-[10px] text-slate-400 mb-1.5">{formatNoteDateTime(msg.created_at)}</p>
                      <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-xl px-4 py-2 text-xs italic leading-relaxed max-w-[90%] text-center whitespace-pre-wrap">
                        {msg.body}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-400">Internal note</p>
                        <button
                          onClick={() => handleAddMessageAsNote(msg.id, noteText)}
                          disabled={isSavingNote || isNoteAdded}
                          className={`text-[9px] font-medium transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100 ${
                            isNoteAdded ? "text-green-600" : "text-slate-400 hover:text-blue-600"
                          }`}
                        >
                          {isSavingNote ? "Adding…" : isNoteAdded ? "✓ Added to notes" : "Add as note"}
                        </button>
                        <button
                          onClick={() => openScheduleFromMessage(msg)}
                          className="text-[9px] font-medium text-slate-400 hover:text-blue-600 transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          Schedule
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="group flex flex-col">
                    <p className={`text-[11px] text-slate-400 mb-1 px-1 ${isOutbound ? "self-end text-right" : ""}`}>
                      {sender}
                    </p>
                    <div
                      className={`max-w-[86%] px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isOutbound
                          ? "ml-auto bg-[#0f1c40] text-white rounded-2xl rounded-tr-sm"
                          : "bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm"
                      }`}
                    >
                      {msg.body}
                    </div>
                    <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isOutbound ? "self-end flex-row-reverse" : ""}`}>
                      <span className="text-[10px] text-slate-400">{formatNoteDateTime(msg.created_at)}</span>
                      <span className="text-slate-300 text-[10px]">·</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${chColor}`}>{ch}</span>
                      <button
                        onClick={() => handleAddMessageAsNote(msg.id, noteText)}
                        disabled={isSavingNote || isNoteAdded}
                        className={`text-[9px] font-medium transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100 ${
                          isNoteAdded
                            ? "text-green-600"
                            : "text-slate-400 hover:text-blue-600"
                        }`}
                      >
                        {isSavingNote ? "Adding…" : isNoteAdded ? "✓ Added" : "Add as note"}
                      </button>
                      <button
                        onClick={() => openScheduleFromMessage(msg)}
                        className="text-[9px] font-medium text-slate-400 hover:text-blue-600 transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── C: Reply Composer ── */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 md:px-5 py-2.5 md:py-3 space-y-2">
          {/* Header: "Reply via" + channel selector */}
          {(() => {
            const canEmail    = !!selectedLead?.email;
            const canFacebook = !!selectedLead?.facebook_sender_id;
            return (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <Send size={11} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Reply via</span>
                  <select
                    value={replyChannel}
                    onChange={(e) => { setReplyChannel(e.target.value); setEmailFeedback(null); }}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:border-blue-400"
                  >
                    <option value="email" disabled={!canEmail}>
                      Email{!canEmail ? " (no address)" : ""}
                    </option>
                    <option value="facebook" disabled={!canFacebook}>
                      Facebook{!canFacebook ? " (no conversation)" : ""}
                    </option>
                    {/* TODO: Add SMS later if Twilio/phone handling becomes part of Tier 3. */}
                  </select>
                  {replyChannel === "email" && canEmail && (
                    <span className="text-xs text-slate-400 ml-auto truncate max-w-[160px]">
                      {selectedLead!.email}
                    </span>
                  )}
                  {replyChannel === "facebook" && canFacebook && (
                    <span className="text-xs text-slate-400 ml-auto">Facebook conversation</span>
                  )}
                </div>

                {/* Email fields */}
                {replyChannel === "email" && canEmail && (
                  <>
                    <input
                      type="text"
                      value={emailDraft.subject}
                      onChange={(e) => { setEmailDraft((d) => ({ ...d, subject: e.target.value })); setEmailFeedback(null); }}
                      placeholder="Subject"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                    />
                    <textarea
                      value={emailDraft.body}
                      onChange={(e) => { setEmailDraft((d) => ({ ...d, body: e.target.value })); setEmailFeedback(null); }}
                      rows={3}
                      placeholder="Write a reply…"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400 resize-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between gap-3">
                      {emailFeedback ? (
                        <span className={`text-xs font-medium ${emailFeedback.type === "success" ? "text-green-600" : "text-red-500"}`}>
                          {emailFeedback.text}
                        </span>
                      ) : <span />}
                      <button
                        onClick={handleSendReply}
                        disabled={emailSending || !emailDraft.subject.trim() || !emailDraft.body.trim()}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#0f1c40] hover:bg-[#1a2d5a] text-white px-3 py-1.5 rounded-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send size={11} />
                        {emailSending ? "Sending…" : "Send reply"}
                      </button>
                    </div>
                  </>
                )}

                {/* Facebook fields */}
                {replyChannel === "facebook" && canFacebook && (
                  <>
                    <textarea
                      value={emailDraft.body}
                      onChange={(e) => { setEmailDraft((d) => ({ ...d, body: e.target.value })); setEmailFeedback(null); }}
                      rows={3}
                      placeholder="Write a reply…"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400 resize-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between gap-3">
                      {emailFeedback ? (
                        <span className={`text-xs font-medium ${emailFeedback.type === "success" ? "text-green-600" : "text-red-500"}`}>
                          {emailFeedback.text}
                        </span>
                      ) : <span />}
                      <button
                        onClick={handleSendReply}
                        disabled={emailSending || !emailDraft.body.trim()}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#0f1c40] hover:bg-[#1a2d5a] text-white px-3 py-1.5 rounded-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send size={11} />
                        {emailSending ? "Sending…" : "Send reply"}
                      </button>
                    </div>
                  </>
                )}

                {/* No channel available */}
                {((replyChannel === "email" && !canEmail) || (replyChannel === "facebook" && !canFacebook)) && (
                  <p className="text-xs text-slate-400 py-1">
                    No direct reply channel available for this lead.
                  </p>
                )}
              </>
            );
          })()}
        </div>

        {/* ── D: Log external conversation — collapsible ── */}
        <div className="shrink-0 border-t border-slate-200 bg-white">
          <button
            onClick={() => setShowLogForm((v) => !v)}
            className="w-full flex items-center justify-between px-4 md:px-5 py-2 md:py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors duration-150 text-left"
          >
            <span>Log external conversation</span>
            <span className="text-[10px] ml-2 shrink-0">{showLogForm ? "▲" : "▼"}</span>
          </button>
          {showLogForm && (
            <div className="px-5 pb-4 pt-1 space-y-2 border-t border-slate-100">
              <p className="text-xs text-slate-400 leading-relaxed">
                Use this to record a Facebook message, phone call, text, email, or other conversation that happened outside this dashboard.
              </p>
              <div className="flex gap-2">
                <select
                  value={messageDraft.channel}
                  onChange={(e) => setMessageDraft((d) => ({ ...d, channel: e.target.value }))}
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                >
                  {SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                  ))}
                </select>
                <select
                  value={messageDraft.direction}
                  onChange={(e) => setMessageDraft((d) => ({ ...d, direction: e.target.value }))}
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                >
                  <option value="inbound">Customer contacted us</option>
                  <option value="outbound">We contacted customer</option>
                  <option value="internal">Internal note / update</option>
                </select>
              </div>
              <textarea
                value={messageDraft.body}
                onChange={(e) => setMessageDraft((d) => ({ ...d, body: e.target.value }))}
                rows={3}
                placeholder="Example: Customer messaged on Facebook asking for a driveway quote next week."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400 resize-none leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveMessage}
                  disabled={messageSaving || !messageDraft.body.trim()}
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {messageSaving ? "Saving…" : "Save message"}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    );
  }

  function renderNotesTab() {
    return (
      <div>
        <p className="text-xs text-slate-400 mb-3">
          Internal notes are private and are not sent to the customer.
        </p>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={4}
          placeholder="Add a note..."
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400 resize-none leading-relaxed"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSaveNote}
            disabled={noteSaving || !noteDraft.trim()}
            className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {noteSaving ? "Saving..." : "Save note"}
          </button>
        </div>

        {/* Note history */}
        <div className="mt-5">
          {notesLoading ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : noteHistory.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No internal notes yet.</p>
          ) : (
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                History
              </div>
              <div className="space-y-3">
                {noteHistory.map((n) => (
                  <div key={n.id} className="border-l-2 border-blue-200 pl-3">
                    <div className="text-xs text-slate-400 mb-1">
                      {formatNoteDateTime(n.created_at)}
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {n.note}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderTimelineTab() {
    if (activitiesLoading) {
      return <p className="text-xs text-slate-400 py-2">Loading...</p>;
    }
    if (activities.length === 0) {
      return <p className="text-xs text-slate-400 italic py-2">No activity yet.</p>;
    }
    return (
      <div>
        {activities.map((activity, index) => {
          const style = ACTIVITY_STYLES[activity.type] ?? DEFAULT_ACTIVITY_STYLE;
          const { Icon } = style;
          const isLast = index === activities.length - 1;
          return (
            <div key={activity.id} className="flex gap-3">
              {/* Icon + connector line */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${style.bg}`}
                >
                  <Icon size={12} className={style.color} />
                </div>
                {!isLast && (
                  <div className="w-px flex-1 bg-slate-100 my-1" style={{ minHeight: "12px" }} />
                )}
              </div>
              {/* Content */}
              <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
                <p className="text-sm text-slate-700 leading-snug">{activity.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatNoteDateTime(activity.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderCalendar() {
    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);

    // Build normalized items: schedule_events + synthetic follow-ups from leads.follow_up_date
    const items: CalItem[] = [];

    for (const ev of scheduleEvents) {
      items.push({
        key: `event-${ev.id}`,
        kind: "event",
        eventId: ev.id,
        leadId: ev.lead_id,
        title: ev.title,
        eventType: ev.event_type,
        startAt: ev.start_at,
        endAt: ev.end_at,
        description: ev.description,
        status: ev.status,
        leadName: ev.lead?.name ?? "—",
        leadEmail: ev.lead?.email ?? null,
        leadPhone: ev.lead?.phone ?? null,
        leadSource: ev.lead?.source ?? null,
      });
    }

    // Leads that already have a schedule_event of type follow_up — skip the synthetic one
    const leadsWithFollowUpEvent = new Set(
      scheduleEvents.filter((e) => e.event_type === "follow_up" && e.lead_id).map((e) => e.lead_id)
    );
    for (const lead of leads) {
      if (!lead.follow_up_date) continue;
      if (leadsWithFollowUpEvent.has(lead.id)) continue;
      // Follow-up dates are date-only; treat as 9:00 AM local
      const startAt = new Date(`${toDateInputValue(lead.follow_up_date)}T09:00`).toISOString();
      items.push({
        key: `followup-${lead.id}`,
        kind: "followup",
        eventId: null,
        leadId: lead.id,
        title: `Follow up with ${lead.business_name || lead.name}`,
        eventType: "follow_up",
        startAt,
        endAt: null,
        description: lead.help_needed,
        status: "scheduled",
        leadName: lead.name,
        leadEmail: lead.email,
        leadPhone: lead.phone,
        leadSource: lead.source,
      });
    }

    // Apply filter
    const filtered = items.filter((it) => {
      const t = new Date(it.startAt);
      const active = it.status === "scheduled" || it.status === "missed";
      switch (calendarFilter) {
        case "today":    return active && t >= todayStart && t <= todayEnd;
        case "week":     return active && t >= todayStart && t <= weekEnd;
        case "upcoming": return active && t >= todayStart;
        case "overdue":  return active && t < now;
        case "all":      return true;
      }
    });

    filtered.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    // Group by calendar day
    const groups: { label: string; items: CalItem[] }[] = [];
    const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1);
    function dayLabel(iso: string): string {
      const d = new Date(iso);
      const ds = new Date(d); ds.setHours(0, 0, 0, 0);
      if (ds.getTime() === todayStart.getTime()) return "Today";
      if (ds.getTime() === tomorrow.getTime()) return "Tomorrow";
      return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }
    for (const it of filtered) {
      const label = dayLabel(it.startAt);
      const existing = groups.find((g) => g.label === label);
      if (existing) existing.items.push(it);
      else groups.push({ label, items: [it] });
    }

    const CAL_FILTERS: { id: typeof calendarFilter; label: string }[] = [
      { id: "today", label: "Today" },
      { id: "week", label: "This week" },
      { id: "upcoming", label: "Upcoming" },
      { id: "overdue", label: "Overdue" },
      { id: "all", label: "All" },
    ];

    const isFaded = (it: CalItem) => it.status === "completed" || it.status === "cancelled";

    // ── Month grid for the calendar view ──────────────────────────────────────
    const gridYear = calMonth.getFullYear();
    const gridMonth = calMonth.getMonth();
    const firstOfMonth = new Date(gridYear, gridMonth, 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(1 - firstOfMonth.getDay()); // back up to the Sunday on/before the 1st
    const dayCells: Date[] = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
    function itemsOnDay(day: Date): CalItem[] {
      return items
        .filter((it) => {
          const d = new Date(it.startAt);
          return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
        })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    }
    const monthLabel = calMonth.toLocaleDateString("en-CA", { month: "long", year: "numeric" });

    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Sub-nav + actions */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-2 flex-wrap shrink-0">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            {(["calendar", "schedule"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setCalendarView(v)}
                className={`text-xs font-semibold px-3 py-1.5 transition-colors duration-150 ${
                  calendarView === v ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:text-slate-700"
                }`}
              >
                {v === "calendar" ? "Calendar" : "Schedule"}
              </button>
            ))}
          </div>
          <button
            onClick={fetchScheduleEvents}
            disabled={scheduleLoading}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 disabled:opacity-40 transition-colors duration-150 ml-1"
          >
            <RefreshCw size={11} className={scheduleLoading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => openAddEvent()}
            className="ml-auto flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors duration-200"
          >
            + Add scheduled item
          </button>
        </div>

        {/* ── Calendar (month) view ── */}
        {calendarView === "calendar" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Month nav */}
            <div className="px-6 py-2.5 flex items-center gap-2 border-b border-slate-100 shrink-0 bg-white">
              <button onClick={() => setCalMonth(new Date(gridYear, gridMonth - 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors duration-150" aria-label="Previous month">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCalMonth(new Date(gridYear, gridMonth + 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors duration-150 rotate-180" aria-label="Next month">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-[#0f1c40] ml-1">{monthLabel}</span>
              <button onClick={() => { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="ml-2 text-xs font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-2.5 py-1 rounded-lg transition-colors duration-150">
                Today
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-100 shrink-0 bg-white">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-center">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-7 auto-rows-fr h-full">
                {dayCells.map((day, i) => {
                  const inMonth = day.getMonth() === gridMonth;
                  const isToday = day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate();
                  const dayItems = itemsOnDay(day);
                  return (
                    <div
                      key={i}
                      onClick={() => openAddEvent(undefined, `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`)}
                      className={`border-b border-r border-slate-100 min-h-[90px] p-1 cursor-pointer transition-colors duration-100 ${
                        inMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/60"
                      }`}
                    >
                      <div className={`text-[11px] font-medium mb-1 px-1 inline-flex items-center justify-center ${
                        isToday ? "bg-blue-600 text-white rounded-full w-5 h-5" : inMonth ? "text-slate-500" : "text-slate-300"
                      }`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayItems.slice(0, 3).map((it) => {
                          const t = new Date(it.startAt);
                          const time = t.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
                          const overdue = it.status === "scheduled" && t < now;
                          return (
                            <button
                              key={it.key}
                              onClick={(e) => { e.stopPropagation(); setSelectedEvent(it); setEventOpenedFrom("calendar"); setConfirmDeleteEvent(false); }}
                              className={`w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate border-l-2 ${
                                EVENT_TYPE_COLORS[it.eventType] ?? "bg-gray-100 text-gray-600"
                              } ${isFaded(it) ? "opacity-50 line-through" : ""} ${overdue ? "ring-1 ring-red-300" : ""}`}
                              style={{ borderLeftColor: "currentColor" }}
                              title={it.title}
                            >
                              <span className="font-semibold">{time.replace(/\s/g, "")}</span> {it.title}
                            </button>
                          );
                        })}
                        {dayItems.length > 3 && (
                          <div className="text-[10px] text-slate-400 px-1">+{dayItems.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Schedule (list) view ── */}
        {calendarView === "schedule" && (
          <>
            <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex items-center gap-2 flex-wrap shrink-0">
              {CAL_FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setCalendarFilter(id)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors duration-150 ${
                    calendarFilter === id
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-200 text-slate-500 bg-white hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
              {scheduleLoading && items.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">Loading schedule…</p>
              ) : groups.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-12 text-center leading-relaxed">
                  No scheduled items{calendarFilter !== "all" ? " for this view" : " yet"}. Use
                  <span className="font-medium"> + Add scheduled item</span> to create follow-ups, calls, estimates, and jobs.
                </p>
              ) : (
                <div className="space-y-6 max-w-3xl">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{group.label}</div>
                      <div className="space-y-2">
                        {group.items.map((it) => {
                          const t = new Date(it.startAt);
                          const time = t.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
                          const isOverdue = it.status === "scheduled" && t < now;
                          return (
                            <button
                              key={it.key}
                              onClick={() => { setSelectedEvent(it); setEventOpenedFrom("calendar"); setConfirmDeleteEvent(false); }}
                              className={`w-full text-left bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm flex gap-3 hover:border-slate-300 transition-colors duration-150 ${
                                isFaded(it) ? "opacity-50" : ""
                              }`}
                            >
                              <div className="shrink-0 w-16 text-right">
                                <div className={`text-sm font-semibold ${isOverdue ? "text-red-500" : "text-[#0f1c40]"}`}>{time}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium text-[#0f1c40] ${it.status === "completed" ? "line-through" : ""}`}>{it.title}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${EVENT_TYPE_COLORS[it.eventType] ?? "bg-gray-100 text-gray-600"}`}>
                                    {EVENT_TYPE_LABELS[it.eventType] ?? it.eventType}
                                  </span>
                                  {it.kind === "event" && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${EVENT_STATUS_COLORS[it.status] ?? "bg-slate-100 text-slate-500"}`}>
                                      {it.status.charAt(0).toUpperCase() + it.status.slice(1)}
                                    </span>
                                  )}
                                  {it.kind === "followup" && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-400">From follow-up date</span>
                                  )}
                                  {isOverdue && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-600">Overdue</span>
                                  )}
                                </div>
                                {it.leadName && it.leadName !== "—" && (
                                  <div className="text-xs text-slate-400 mt-0.5">Lead: {it.leadName}</div>
                                )}
                                {it.description && (
                                  <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{it.description}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderInbox() {
    const INBOX_FILTERS: { id: typeof inboxFilter; label: string }[] = [
      { id: "all", label: "All" },
      { id: "needs_response", label: "Needs response" },
      { id: "unread", label: "Unread" },
      { id: "email", label: "Email" },
      { id: "facebook", label: "Facebook" },
    ];

    // Preview = the most recent message for the lead (prefixed with "You: " when
    // outbound), falling back to the original request if no messages exist yet.
    function convPreview(lead: Lead): string {
      const latest = latestMsgByLead[lead.id];
      if (latest) {
        const prefix = latest.direction === "outbound" ? "You: " : "";
        return (prefix + latest.body).trim() || "Conversation";
      }
      const text = lead.message || lead.help_needed || "";
      return text || "Conversation";
    }

    return (
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Conversation list ── */}
        <div
          className={`flex-col w-full lg:w-[360px] border-r border-slate-100 bg-white min-h-0 ${
            selectedLead ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Filters */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-1.5 flex-wrap shrink-0">
            {INBOX_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setInboxFilter(id)}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors duration-150 ${
                  inboxFilter === id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-200 text-slate-500 bg-white hover:border-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {conversations.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-xs text-slate-400 italic leading-relaxed">
                  {inboxFilter === "all"
                    ? "No conversations yet. Website inquiries, Facebook messages, and email replies will appear here."
                    : "No conversations match this filter."}
                </p>
              </div>
            ) : (
              conversations.map((lead) => {
                const isSel = lead.id === selectedId;
                const ch = leadChannel(lead);
                return (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors duration-100 ${
                      isSel ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#0f1c40] text-sm truncate min-w-0">
                        {lead.name}
                      </span>
                      {lead.unread_count > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold shrink-0">
                          {lead.unread_count}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 shrink-0 ml-auto">
                        {(() => {
                          const at = latestMsgByLead[lead.id]?.created_at ?? lead.last_message_at;
                          return at ? formatShortDateTime(at) : "";
                        })()}
                      </span>
                    </div>
                    {lead.business_name && (
                      <div className="text-xs text-slate-400 truncate mt-0.5">{lead.business_name}</div>
                    )}
                    <p className="text-xs text-slate-500 truncate mt-1">{convPreview(lead)}</p>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <SourceBadge source={ch} />
                      {lead.has_unread_messages && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700">
                          <Bell size={8} />
                          New
                        </span>
                      )}
                      {lead.needs_response && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
                          Needs response
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Thread + composer ── */}
        <div
          className={`flex-1 flex-col min-h-0 bg-slate-50 ${
            selectedLead ? "flex" : "hidden lg:flex"
          }`}
        >
          {selectedLead ? (
            <>
              {/* Lead quick info bar */}
              <div className="shrink-0 bg-white border-b border-slate-100 px-4 md:px-5 py-2.5 md:py-3">
                <div className="flex items-start gap-2 md:gap-3">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden p-1 -ml-1 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#0f1c40] text-sm truncate max-w-[55vw] md:max-w-none">{selectedLead.name}</span>
                      <StatusBadge status={selectedLead.status} />
                      {selectedLead.urgency === "emergency" && <UrgencyBadge urgency={selectedLead.urgency} />}
                    </div>
                    {/* Mobile: single muted contact line */}
                    <div className="md:hidden text-xs text-slate-400 truncate mt-0.5">
                      {selectedLead.email
                        || selectedLead.phone
                        || (selectedLead.facebook_sender_id ? "Messenger" : "")
                        || (selectedLead.follow_up_date ? `Follow-up ${formatMonthDay(selectedLead.follow_up_date)}` : "")}
                    </div>
                    {/* Desktop: full contact details */}
                    <div className="hidden md:flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      {selectedLead.email && <span className="truncate max-w-[200px]">{selectedLead.email}</span>}
                      {selectedLead.phone && <span>{selectedLead.phone}</span>}
                      {selectedLead.facebook_sender_id && (
                        <span className="inline-flex items-center gap-1 text-teal-600">
                          <Facebook size={11} /> Messenger
                        </span>
                      )}
                      {selectedLead.follow_up_date && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={10} /> {formatMonthDay(selectedLead.follow_up_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setTopTab("leads"); setActiveTab("overview"); }}
                    className="shrink-0 text-xs font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-2.5 py-1 rounded-lg transition-colors duration-150"
                  >
                    Open full lead
                  </button>
                </div>
              </div>

              {/* Reuse the existing Messages thread + channel-aware composer */}
              {renderMessagesTab()}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center px-6">
              <p className="text-sm text-slate-400 text-center max-w-xs leading-relaxed">
                Select a conversation to view the thread and reply.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col bg-slate-50 h-screen overflow-hidden"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* ── Header ── */}
      <header className="bg-[#0f1c40] text-white px-4 md:px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <span className="font-semibold text-sm truncate">Onward Systems</span>
          <span className="text-white/30 text-xs hidden sm:inline">|</span>
          <span className="text-blue-300 text-sm hidden sm:inline">Admin</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* + Add Lead lives in the Leads toolbar on mobile to keep the header uncluttered */}
          <button
            onClick={() => setShowAddLead(true)}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors duration-200"
          >
            + Add Lead
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors duration-200"
            aria-label="Sign out"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Top-level nav: Inbox | Leads ── */}
      <div className="bg-white border-b border-slate-100 px-2 md:px-6 flex items-center gap-1 shrink-0 overflow-x-auto">
        {([
          { id: "inbox", label: "Inbox", Icon: Inbox },
          { id: "leads", label: "Leads", Icon: Users },
          { id: "calendar", label: "Calendar", Icon: Calendar },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => { setTopTab(id); if (id === "leads") setSelectedId(null); }}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 ${
              topTab === id
                ? "text-blue-600 border-blue-600"
                : "text-slate-400 border-transparent hover:text-slate-600"
            }`}
          >
            <Icon size={14} />
            {label}
            {id === "inbox" && totalUnread > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                {totalUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {topTab === "inbox" && renderInbox()}
        {topTab === "calendar" && renderCalendar()}
        {topTab === "leads" && (
        <>
        {/* ── Left panel: table ── */}
        <div
          className={`flex flex-col flex-1 overflow-hidden ${
            selectedLead ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Overview stats — interactive filters. Desktop cards / mobile chips. */}
          {(() => {
            const STATS = [
              { kind: "all" as const, label: "Total leads", chip: "All", value: stats.total, Icon: Users, color: "text-slate-600 bg-slate-100", active: "border-slate-300 bg-slate-50 ring-1 ring-slate-200" },
              { kind: "new" as const, label: "New", chip: "New", value: stats.new, Icon: Inbox, color: "text-blue-600 bg-blue-50", active: "border-blue-300 bg-blue-50 ring-1 ring-blue-200" },
              { kind: "needs" as const, label: "Needs response", chip: "Needs reply", value: stats.needsResponse, Icon: Reply, color: "text-orange-600 bg-orange-50", active: "border-orange-300 bg-orange-50 ring-1 ring-orange-200" },
              { kind: "due" as const, label: "Follow-up due", chip: "Due", value: stats.followUpDue, Icon: Clock, color: "text-amber-600 bg-amber-50", active: "border-amber-300 bg-amber-50 ring-1 ring-amber-200" },
            ];
            return (
              <div className="bg-white border-b border-slate-100 shrink-0">
                {/* Mobile: compact horizontal chips */}
                <div className="flex md:hidden gap-2 overflow-x-auto px-4 py-2.5">
                  {STATS.map(({ kind, chip, value, active }) => {
                    const isActive = activeStat === kind;
                    return (
                      <button
                        key={kind}
                        onClick={() => applyStatFilter(kind)}
                        aria-pressed={isActive}
                        className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                          isActive ? active : "border-slate-200 text-slate-600 bg-white"
                        }`}
                      >
                        {chip}
                        <span className="font-bold text-[#0f1c40]">{value}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Desktop/tablet: clickable cards */}
                <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-5">
                  {STATS.map(({ kind, label, value, Icon, color, active }) => {
                    const isActive = activeStat === kind;
                    return (
                      <button
                        key={kind}
                        onClick={() => applyStatFilter(kind)}
                        aria-pressed={isActive}
                        className={`text-left bg-white border rounded-xl p-4 flex items-center gap-3 shadow-sm min-w-0 transition-colors duration-150 ${
                          isActive ? active : "border-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-2xl font-bold text-[#0f1c40] leading-none">{value}</div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">{label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Filters — compact on mobile (dropdowns collapse behind "Filters"); full row on desktop */}
          <div className="px-4 md:px-6 py-2.5 md:py-3 bg-white border-b border-slate-100 flex items-center gap-2 md:gap-3 flex-wrap shrink-0">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`md:hidden text-sm border rounded-lg px-3 py-1.5 transition-colors duration-150 ${
                showFilters ? "bg-slate-100 text-slate-700 border-slate-300 font-medium" : "border-slate-200 text-slate-600 bg-white"
              }`}
            >
              Filters
            </button>
            <span className="hidden md:inline text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Filter
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${showFilters ? "block" : "hidden"} md:block text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400`}
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className={`${showFilters ? "block" : "hidden"} md:block text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400`}
            >
              <option value="all">All urgency</option>
              <option value="emergency">Emergency</option>
              <option value="priority">Priority</option>
              <option value="normal">Normal</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as "desc" | "asc")}
              className={`${showFilters ? "block" : "hidden"} md:block text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400`}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
            <button
              onClick={() => setStatusFilter((s) => (s === "prospect" ? "all" : "prospect"))}
              className={`text-sm border rounded-lg px-3 py-1.5 transition-colors duration-150 ${
                statusFilter === "prospect"
                  ? "bg-violet-100 text-violet-700 border-violet-300 font-medium"
                  : "border-slate-200 text-slate-600 bg-white hover:border-slate-300"
              }`}
            >
              Prospects
            </button>
            <button
              onClick={() => setNeedsResponseFilter((v) => !v)}
              className={`text-sm border rounded-lg px-3 py-1.5 transition-colors duration-150 ${
                needsResponseFilter
                  ? "bg-orange-100 text-orange-700 border-orange-300 font-medium"
                  : "border-slate-200 text-slate-600 bg-white hover:border-slate-300"
              }`}
            >
              Needs<span className="hidden sm:inline"> response</span>
            </button>
            <span className="text-xs text-slate-400 ml-auto">
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setShowAddLead(true)}
              className="md:hidden text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors duration-200"
            >
              + Add
            </button>
          </div>

          {/* Mobile: tappable lead cards (replaces the wide table below md) */}
          <div className="flex-1 overflow-auto md:hidden bg-white divide-y divide-slate-100">
            {filteredLeads.length === 0 ? (
              <p className="px-4 py-14 text-center text-slate-400 text-sm">No leads found.</p>
            ) : (
              filteredLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors duration-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-[#0f1c40] truncate">{lead.name}</div>
                      {lead.business_name && (
                        <div className="text-xs text-slate-400 truncate">{lead.business_name}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                      {lead.last_message_at ? formatShortDateTime(lead.last_message_at) : formatDate(lead.created_at)}
                    </span>
                  </div>
                  {lead.help_needed && (
                    <div className="text-xs text-slate-500 truncate mt-1">{lead.help_needed}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {lead.source && <SourceBadge source={lead.source} />}
                    <StatusBadge status={lead.status} />
                    {(lead.urgency === "emergency" || lead.urgency === "priority") && <UrgencyBadge urgency={lead.urgency} />}
                    {lead.has_unread_messages && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700">
                        <Bell size={8} /> New
                      </span>
                    )}
                    {lead.needs_response && !lead.has_unread_messages && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
                        Needs response
                      </span>
                    )}
                    {lead.follow_up_date && (
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        isFollowUpPastDue(lead.follow_up_date) ? "bg-red-100 text-red-600"
                        : isFollowUpToday(lead.follow_up_date) ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                      }`}>
                        <Clock size={8} />
                        {isFollowUpPastDue(lead.follow_up_date) ? "Overdue" : isFollowUpToday(lead.follow_up_date) ? "Due today" : formatMonthDay(lead.follow_up_date)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  {["Name / Business", "Help needed", "Urgency", "Status", "Activity", "Contact"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-slate-400 text-sm">
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedId(lead.id === selectedId ? null : lead.id)}
                      className={`cursor-pointer transition-colors duration-100 ${
                        lead.id === selectedId ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-[#0f1c40]">{lead.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{lead.business_name}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {lead.source && <SourceBadge source={lead.source} />}
                          {lead.has_unread_messages && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700">
                              <Bell size={8} />
                              New message
                            </span>
                          )}
                          {lead.needs_response && !lead.has_unread_messages && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
                              Needs response
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 max-w-[180px]">
                        <span className="text-slate-600 truncate block">{lead.help_needed || "—"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <UrgencyBadge urgency={lead.urgency} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                        {/* Primary: last message timestamp, or submitted date */}
                        {lead.last_message_at ? (
                          <>
                            <div className="text-slate-600 font-medium">
                              {formatShortDateTime(lead.last_message_at)}
                            </div>
                            <div className="text-slate-400 mt-0.5">
                              {DIRECTION_ACTIVITY_LABELS[lead.last_message_direction ?? ""] ?? "Message"}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-slate-600">{formatDate(lead.created_at)}</div>
                            <div className="text-slate-400 mt-0.5">Submitted</div>
                          </>
                        )}
                        {/* Secondary: follow-up */}
                        {lead.follow_up_date && (
                          <div
                            className={`mt-1.5 flex items-center gap-1 ${
                              isFollowUpPastDue(lead.follow_up_date)
                                ? "text-red-500 font-medium"
                                : isFollowUpToday(lead.follow_up_date)
                                ? "text-amber-500 font-medium"
                                : "text-slate-400"
                            }`}
                          >
                            <Clock size={9} />
                            {isFollowUpPastDue(lead.follow_up_date)
                              ? `Overdue: ${formatMonthDay(lead.follow_up_date)}`
                              : isFollowUpToday(lead.follow_up_date)
                              ? "Due today"
                              : `Follow-up: ${formatMonthDay(lead.follow_up_date)}`}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-slate-600 text-xs truncate max-w-[140px]">{lead.email}</div>
                        <div className="text-slate-400 text-xs mt-0.5">{lead.phone ?? ""}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right panel: lead detail ── */}
        {selectedLead && (
          <div className="w-full lg:w-[560px] xl:w-[620px] bg-white border-l border-slate-100 flex flex-col overflow-hidden shrink-0 min-h-0">
            {/* Panel header — compact on mobile */}
            <div className="px-4 md:px-6 pt-3 md:pt-5 pb-3 md:pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 pr-1 md:pr-3">
                  <div className="font-semibold text-[#0f1c40] text-base leading-tight truncate">
                    {selectedLead.name}
                  </div>
                  {selectedLead.business_name && (
                    <div className="text-xs md:text-sm text-slate-500 mt-0.5 truncate">{selectedLead.business_name}</div>
                  )}
                  <div className="flex items-center gap-1.5 md:gap-2 mt-1.5 md:mt-2 flex-wrap">
                    {selectedLead.source && <SourceBadge source={selectedLead.source} />}
                    <StatusBadge status={selectedLead.status} />
                    {selectedLead.urgency === "emergency" && (
                      <UrgencyBadge urgency={selectedLead.urgency} />
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors duration-150 shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Tab strip */}
            <div className="flex border-b border-slate-100 shrink-0 overflow-x-auto">
              {DETAIL_TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 md:py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 ${
                    activeTab === id
                      ? "text-blue-600 border-blue-600"
                      : "text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "messages" ? (
              renderMessagesTab()
            ) : (
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
                {activeTab === "overview" && renderOverviewTab()}
                {activeTab === "notes" && renderNotesTab()}
                {activeTab === "timeline" && renderTimelineTab()}
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>

      {/* ── Event Detail Modal ── */}
      {selectedEvent && (() => {
        const ev = selectedEvent;
        const t = new Date(ev.startAt);
        const whenLabel = t.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
          + " · " + t.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
        const isReal = ev.kind === "event" && !!ev.eventId;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => { setSelectedEvent(null); setConfirmDeleteEvent(false); }} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="font-semibold text-[#0f1c40] leading-tight">{ev.title}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${EVENT_TYPE_COLORS[ev.eventType] ?? "bg-gray-100 text-gray-600"}`}>
                      {EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}
                    </span>
                    {isReal && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${EVENT_STATUS_COLORS[ev.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {ev.status.charAt(0).toUpperCase() + ev.status.slice(1)}
                      </span>
                    )}
                    {ev.kind === "followup" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-400">From follow-up date</span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setSelectedEvent(null); setConfirmDeleteEvent(false); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors duration-150 shrink-0">
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-4 space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="text-slate-400 w-20 shrink-0">When</span>
                  <span className="text-slate-700">{whenLabel}</span>
                </div>
                {ev.leadName && ev.leadName !== "—" && (
                  <div className="flex gap-3">
                    <span className="text-slate-400 w-20 shrink-0">Lead</span>
                    <span className="text-slate-700">{ev.leadName}</span>
                  </div>
                )}
                {ev.description && (
                  <div className="flex gap-3">
                    <span className="text-slate-400 w-20 shrink-0">Notes</span>
                    <span className="text-slate-700 whitespace-pre-wrap" style={{ overflowWrap: "anywhere" }}>{ev.description}</span>
                  </div>
                )}
                {ev.kind === "followup" && (
                  <p className="text-xs text-slate-400 italic">This item comes from the lead&apos;s follow-up date. Open the lead to edit or clear it.</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap px-6 py-4 border-t border-slate-100">
                {eventOpenedFrom === "lead" ? (
                  <button
                    onClick={() => {
                      const d = new Date(ev.startAt);
                      setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                      setCalendarView("calendar");
                      setTopTab("calendar");
                      setSelectedEvent(null);
                      setConfirmDeleteEvent(false);
                    }}
                    className="text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors duration-150"
                  >
                    Open calendar
                  </button>
                ) : (
                  ev.leadId && (
                    <button
                      onClick={() => { setSelectedId(ev.leadId); setActiveTab("overview"); setTopTab("leads"); setSelectedEvent(null); }}
                      className="text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors duration-150"
                    >
                      Open lead
                    </button>
                  )
                )}
                <button onClick={() => downloadEventIcs(ev)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors duration-150">
                  <Calendar size={12} /> Add to calendar
                </button>
                {isReal && ev.status !== "completed" && (
                  <button onClick={() => handleEventStatus(ev.eventId!, "completed")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors duration-150">
                    <CheckCheck size={12} /> Mark complete
                  </button>
                )}
                {isReal && ev.status === "scheduled" && (
                  <button onClick={() => handleEventStatus(ev.eventId!, "cancelled")} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors duration-150">
                    Cancel
                  </button>
                )}
                {isReal && (
                  confirmDeleteEvent ? (
                    <span className="ml-auto inline-flex items-center gap-2">
                      <span className="text-xs text-red-600">Delete?</span>
                      <button onClick={() => handleDeleteEvent(ev.eventId!)} className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg transition-colors duration-150">Yes, delete</button>
                      <button onClick={() => setConfirmDeleteEvent(false)} className="text-xs text-slate-400 hover:text-slate-600">No</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDeleteEvent(true)} className="ml-auto text-xs font-medium text-red-500 hover:text-red-700 transition-colors duration-150">
                      Delete event
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Add Scheduled Item Modal ── */}
      {showAddEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddEvent(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-[#0f1c40]">Add scheduled item</h2>
              <button onClick={() => setShowAddEvent(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors duration-150">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Lead</label>
                {(() => {
                  const q = leadQuery.trim().toLowerCase();
                  const matches = (q
                    ? leads.filter((l) =>
                        l.name.toLowerCase().includes(q) || (l.business_name ?? "").toLowerCase().includes(q))
                    : [...leads]
                  )
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .slice(0, 8);
                  function pick(l: Lead) {
                    setEventForm((f) => ({ ...f, lead_id: l.id }));
                    setLeadQuery(l.name);
                    setShowLeadDropdown(false);
                  }
                  return (
                    <>
                      <input
                        ref={addEventLeadRef}
                        type="text"
                        value={leadQuery}
                        onChange={(e) => {
                          setLeadQuery(e.target.value);
                          setShowLeadDropdown(true);
                          if (!e.target.value.trim()) setEventForm((f) => ({ ...f, lead_id: "" }));
                        }}
                        onFocus={() => setShowLeadDropdown(true)}
                        onBlur={() => setTimeout(() => setShowLeadDropdown(false), 120)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && showLeadDropdown && matches.length > 0) {
                            e.preventDefault();
                            pick(matches[0]);
                          }
                        }}
                        placeholder="Search a lead by name… (optional)"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                      />
                      {showLeadDropdown && matches.length > 0 && (
                        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                          {matches.map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); pick(l); }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors duration-100 ${
                                l.id === eventForm.lead_id ? "bg-blue-50" : ""
                              }`}
                            >
                              <span className="text-slate-700">{l.name}</span>
                              {l.business_name && <span className="text-slate-400"> · {l.business_name}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Estimate for driveway pressure washing"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Type</label>
                  <select
                    value={eventForm.event_type}
                    onChange={(e) => setEventForm((f) => ({ ...f, event_type: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  >
                    {Object.entries(EVENT_TYPE_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Status</label>
                  <select
                    value={eventForm.status}
                    onChange={(e) => setEventForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="missed">Missed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Start date <span className="text-red-400">*</span></label>
                  <input ref={addEventStartRef} type="date" value={eventForm.start_date} onChange={(e) => setEventForm((f) => ({ ...f, start_date: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Start time</label>
                  <TimeField
                    time={eventForm.start_time}
                    ampm={eventForm.start_ampm}
                    onTimeChange={(v) => { setEventForm((f) => ({ ...f, start_time: v })); setEventError(null); }}
                    onAmpmChange={(v) => setEventForm((f) => ({ ...f, start_ampm: v }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">End date</label>
                  <input type="date" value={eventForm.end_date} onChange={(e) => setEventForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">End time</label>
                  <TimeField
                    time={eventForm.end_time}
                    ampm={eventForm.end_ampm}
                    onTimeChange={(v) => { setEventForm((f) => ({ ...f, end_time: v })); setEventError(null); }}
                    onAmpmChange={(v) => setEventForm((f) => ({ ...f, end_ampm: v }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
                <textarea rows={2} value={eventForm.description} onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400 resize-none leading-relaxed" />
              </div>
              {eventError && (
                <p className="text-xs text-red-600 font-medium">{eventError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowAddEvent(false)} className="text-sm text-slate-500 hover:text-slate-700 transition-colors duration-150">Cancel</button>
              <button
                onClick={() => handleSaveEvent(false)}
                disabled={eventSaving || !eventForm.title.trim() || !eventForm.start_date}
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {eventSaving ? "Saving…" : "Save item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Lead Modal ── */}
      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowAddLead(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-[#0f1c40]">Add Lead</h2>
              <button
                onClick={() => setShowAddLead(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors duration-150"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={addLeadForm.name}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Business name
                  </label>
                  <input
                    type="text"
                    value={addLeadForm.business_name}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, business_name: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={addLeadForm.email}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={addLeadForm.phone}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Website
                  </label>
                  <input
                    type="text"
                    value={addLeadForm.website_url}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, website_url: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Facebook
                  </label>
                  <input
                    type="text"
                    value={addLeadForm.facebook_url}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, facebook_url: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Business type
                  </label>
                  <input
                    type="text"
                    value={addLeadForm.business_type}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, business_type: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Service / Help needed
                  </label>
                  <input
                    type="text"
                    value={addLeadForm.help_needed}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, help_needed: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                  Message
                </label>
                <textarea
                  rows={3}
                  value={addLeadForm.message}
                  onChange={(e) => setAddLeadForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400 resize-none leading-relaxed"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Source
                  </label>
                  <select
                    value={addLeadForm.source}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, source: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  >
                    {SOURCE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Urgency
                  </label>
                  <select
                    value={addLeadForm.urgency}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, urgency: e.target.value as "emergency" | "priority" | "normal" }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  >
                    <option value="normal">Normal</option>
                    <option value="priority">Priority</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Status
                  </label>
                  <select
                    value={addLeadForm.status}
                    onChange={(e) => {
                      const status = e.target.value as Lead["status"];
                      setAddLeadForm((f) => ({
                        ...f,
                        status,
                        // Prospect defaults: help_needed = Prospecting, urgency = Normal
                        help_needed: status === "prospect" && !f.help_needed.trim() ? "Prospecting" : f.help_needed,
                        urgency: status === "prospect" ? "normal" : f.urgency,
                      }));
                    }}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowAddLead(false)}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLead}
                disabled={addLeadSaving || !addLeadForm.name.trim() || !addLeadForm.email.trim()}
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {addLeadSaving ? "Saving..." : "Add lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
