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
  business_type: string | null;
  help_needed: string | null;
  message: string | null;
  urgency: "emergency" | "normal";
  status: "new" | "contacted" | "quoted" | "booked" | "completed" | "lost";
  source: string | null;
  notes: string | null;
  follow_up_date: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  has_unread_messages: boolean;
  needs_response: boolean;
  facebook_sender_id: string | null;
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

type DetailTab = "overview" | "messages" | "notes" | "timeline";

const STATUS_OPTIONS = [
  "new",
  "contacted",
  "quoted",
  "booked",
  "completed",
  "lost",
] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  booked: "Booked",
  completed: "Completed",
  lost: "Lost",
};

const STATUS_COLORS: Record<Status, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  quoted: "bg-purple-100 text-purple-700",
  booked: "bg-green-100 text-green-700",
  completed: "bg-slate-100 text-slate-600",
  lost: "bg-red-100 text-red-600",
};

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
  const [topTab, setTopTab] = useState<"inbox" | "leads">(() =>
    initialLeads.some((l) => l.needs_response) ? "inbox" : "leads"
  );
  const [inboxFilter, setInboxFilter] = useState<"all" | "needs_response" | "unread" | "email" | "facebook">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [needsResponseFilter, setNeedsResponseFilter] = useState(false);
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
    website_or_facebook: "",
    business_type: "",
    help_needed: "",
    message: "",
    urgency: "normal" as "emergency" | "normal",
  });

  // Notes state
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteHistory, setNoteHistory] = useState<LeadNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
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
    website_or_facebook: "",
    business_type: "",
    help_needed: "",
    message: "",
    source: "manual",
    urgency: "normal" as "emergency" | "normal",
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

  // Scroll the thread container when messages change.
  // On initial load / manual refresh: always jump to the newest message.
  // On Realtime updates: only scroll if the user is already within 150px of the bottom,
  // so reading old history is not interrupted.
  useEffect(() => {
    if (activeTab !== "messages" || messagesLoading || messages.length === 0) return;
    const el = threadRef.current;
    if (!el) return;
    if (justLoadedRef.current) {
      el.scrollTop = el.scrollHeight;
      justLoadedRef.current = false;
    } else {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 150) el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, activeTab, messagesLoading]);

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

  // Poll leads list every 60 seconds so unread/needs-response badges stay current
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/leads");
        if (!res.ok) return;
        const { data } = await res.json();
        if (data) setLeads(data);
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
      if (leadsJson.data) setLeads(leadsJson.data);
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
    let out = [...leads];
    if (statusFilter !== "all") out = out.filter((l) => l.status === statusFilter);
    if (urgencyFilter !== "all") out = out.filter((l) => l.urgency === urgencyFilter);
    if (needsResponseFilter) out = out.filter((l) => l.needs_response);
    out.sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "desc" ? -diff : diff;
    });
    return out;
  }, [leads, statusFilter, urgencyFilter, sortDir, needsResponseFilter]);

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

  const needsResponseCount = useMemo(
    () => leads.filter((l) => l.needs_response).length,
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
        setMessages((prev) => [...prev, data]);
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
        if (json.message) setMessages((prev) => [...prev, json.message]);
        if (json.activity) setActivities((prev) => [json.activity, ...prev]);
        setEmailFeedback({ type: "success", text: "Reply sent." });
        const sentAt = new Date().toISOString();
        setLeads((prev) =>
          prev.map((l) =>
            l.id === selectedId
              ? { ...l, last_message_at: sentAt, last_message_direction: "outbound", has_unread_messages: false, needs_response: false }
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
        setLeads((prev) => [data, ...prev]);
        setShowAddLead(false);
        setAddLeadForm({
          name: "",
          business_name: "",
          email: "",
          phone: "",
          website_or_facebook: "",
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
    setEditDraft({
      name: selectedLead.name ?? "",
      business_name: selectedLead.business_name ?? "",
      email: selectedLead.email ?? "",
      phone: selectedLead.phone ?? "",
      website_or_facebook: selectedLead.website_or_facebook ?? "",
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
      const res = await fetch(`/api/admin/leads/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDraft.name.trim(),
          business_name: editDraft.business_name.trim(),
          email: editDraft.email.trim() || null,
          phone: editDraft.phone.trim() || null,
          website_or_facebook: editDraft.website_or_facebook.trim() || null,
          business_type: editDraft.business_type.trim() || null,
          help_needed: editDraft.help_needed.trim() || null,
          message: editDraft.message.trim() || null,
          urgency: editDraft.urgency,
        }),
      });
      if (res.ok) {
        const saved = {
          name: editDraft.name.trim(),
          business_name: editDraft.business_name.trim(),
          email: editDraft.email.trim() || null,
          phone: editDraft.phone.trim() || null,
          website_or_facebook: editDraft.website_or_facebook.trim() || null,
          business_type: editDraft.business_type.trim() || null,
          help_needed: editDraft.help_needed.trim() || null,
          message: editDraft.message.trim() || null,
          urgency: editDraft.urgency,
        };
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
    await patchLead(selectedId, { has_unread_messages: false });
  }

  async function handleMarkAsHandled() {
    if (!selectedId) return;
    await patchLead(selectedId, { has_unread_messages: false, needs_response: false });
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
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1.5">
              Urgency
            </label>
            <div className="py-2">
              <UrgencyBadge urgency={selectedLead.urgency} />
            </div>
          </div>
        </div>

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
          {selectedLead.follow_up_date && (
            <button
              onClick={handleCalendarExport}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors duration-150"
            >
              <Calendar size={12} />
              Add follow-up to calendar
            </button>
          )}
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
                  onChange={(e) => setEditDraft((d) => ({ ...d, urgency: e.target.value as "emergency" | "normal" }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                >
                  <option value="normal">Normal</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>

            {!selectedLead.facebook_sender_id && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Website / Facebook</label>
                <input
                  type="text"
                  value={editDraft.website_or_facebook}
                  onChange={(e) => setEditDraft((d) => ({ ...d, website_or_facebook: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
            )}

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
                <InfoRow
                  label="Website / FB"
                  value={
                    selectedLead.facebook_sender_id ? (
                      <span className="text-slate-600">
                        Facebook Messenger
                        <span className="ml-1.5 text-xs text-teal-600 font-medium">· Connected</span>
                      </span>
                    ) : selectedLead.website_or_facebook ? (
                      <a
                        href={selectedLead.website_or_facebook.startsWith("http") ? selectedLead.website_or_facebook : `https://${selectedLead.website_or_facebook}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {selectedLead.website_or_facebook}
                      </a>
                    ) : "—"
                  }
                />
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

        {/* ── A: Action bar ── */}
        <div className="shrink-0 flex items-center gap-2 flex-wrap px-5 py-2 border-b border-slate-100 bg-white">
          {hasAlert && (
            <>
              <Bell size={12} className="text-teal-600 shrink-0" />
              <span className="text-xs text-teal-700 flex-1 min-w-0">
                {selectedLead?.has_unread_messages ? "Unread message" : "Needs response"}
              </span>
              {selectedLead?.has_unread_messages && (
                <button
                  onClick={handleMarkAsRead}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-1 rounded-lg transition-colors duration-150"
                >
                  <CheckCheck size={10} />
                  Mark as read
                </button>
              )}
              {selectedLead?.needs_response && (
                <button
                  onClick={handleMarkAsHandled}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg transition-colors duration-150"
                >
                  Mark as handled
                </button>
              )}
            </>
          )}
          <button
            onClick={handleRefreshMessages}
            disabled={messagesRefreshing || messagesLoading}
            className={`inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 disabled:opacity-40 transition-colors duration-150 ${!hasAlert ? "ml-auto" : ""}`}
          >
            <RefreshCw size={10} className={messagesRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── B: Conversation thread — fills all remaining height ── */}
        <div
          ref={threadRef}
          className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-5 py-4"
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── C: Reply Composer ── */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 space-y-2">
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
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors duration-150 text-left"
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

  function renderInbox() {
    const INBOX_FILTERS: { id: typeof inboxFilter; label: string }[] = [
      { id: "all", label: "All" },
      { id: "needs_response", label: "Needs response" },
      { id: "unread", label: "Unread" },
      { id: "email", label: "Email" },
      { id: "facebook", label: "Facebook" },
    ];

    function convPreview(lead: Lead): string {
      const dir = lead.last_message_direction;
      const prefix = dir === "outbound" ? "You: " : "";
      const text = lead.message || lead.help_needed || "";
      if (!text) {
        return dir === "outbound" ? "You replied" : dir === "inbound" ? "New message" : "Conversation";
      }
      return prefix + text;
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
                      <span className="font-medium text-[#0f1c40] text-sm truncate flex-1 min-w-0">
                        {lead.name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {lead.last_message_at ? formatShortDateTime(lead.last_message_at) : ""}
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
              <div className="shrink-0 bg-white border-b border-slate-100 px-5 py-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden p-1 -ml-1 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#0f1c40] text-sm">{selectedLead.name}</span>
                      <StatusBadge status={selectedLead.status} />
                      {selectedLead.urgency === "emergency" && <UrgencyBadge urgency={selectedLead.urgency} />}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      {selectedLead.email && <span className="truncate">{selectedLead.email}</span>}
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
      <header className="bg-[#0f1c40] text-white px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">Onward Systems</span>
          <span className="text-white/30 text-xs">|</span>
          <span className="text-blue-300 text-sm">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddLead(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors duration-200"
          >
            + Add Lead
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors duration-200"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      {/* ── Top-level nav: Inbox | Leads ── */}
      <div className="bg-white border-b border-slate-100 px-6 flex items-center gap-1 shrink-0">
        {([
          { id: "inbox", label: "Inbox", Icon: Inbox },
          { id: "leads", label: "Leads", Icon: Users },
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
            {id === "inbox" && needsResponseCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                {needsResponseCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {topTab === "inbox" && renderInbox()}
        {topTab === "leads" && (
        <>
        {/* ── Left panel: table ── */}
        <div
          className={`flex flex-col flex-1 overflow-hidden ${
            selectedLead ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Overview cards */}
          <div className="px-6 py-5 bg-white border-b border-slate-100 shrink-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total leads", value: stats.total, Icon: Users, color: "text-slate-600 bg-slate-100" },
                { label: "New", value: stats.new, Icon: Inbox, color: "text-blue-600 bg-blue-50" },
                { label: "Needs response", value: stats.needsResponse, Icon: Reply, color: "text-orange-600 bg-orange-50" },
                { label: "Follow-up due", value: stats.followUpDue, Icon: Clock, color: "text-amber-600 bg-amber-50" },
              ].map(({ label, value, Icon, color }) => (
                <div
                  key={label}
                  className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-3 shadow-sm"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#0f1c40] leading-none">{value}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-3 flex-wrap shrink-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Filter
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="all">All urgency</option>
              <option value="emergency">Emergency</option>
              <option value="normal">Normal</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as "desc" | "asc")}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
            <button
              onClick={() => setNeedsResponseFilter((v) => !v)}
              className={`text-sm border rounded-lg px-3 py-1.5 transition-colors duration-150 ${
                needsResponseFilter
                  ? "bg-orange-100 text-orange-700 border-orange-300 font-medium"
                  : "border-slate-200 text-slate-600 bg-white hover:border-slate-300"
              }`}
            >
              Needs response
            </button>
            <span className="text-xs text-slate-400 ml-auto">
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
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
          <div className="w-full lg:w-[520px] bg-white border-l border-slate-100 flex flex-col overflow-hidden shrink-0 min-h-0">
            {/* Panel header — always visible */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="font-semibold text-[#0f1c40] text-base leading-tight">
                    {selectedLead.name}
                  </div>
                  {selectedLead.business_name && (
                    <div className="text-sm text-slate-500 mt-0.5">{selectedLead.business_name}</div>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 ${
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
              <div className="flex-1 overflow-y-auto px-6 py-5">
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
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                  Website / Facebook
                </label>
                <input
                  type="text"
                  value={addLeadForm.website_or_facebook}
                  onChange={(e) => setAddLeadForm((f) => ({ ...f, website_or_facebook: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                />
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
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, urgency: e.target.value as "emergency" | "normal" }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400"
                  >
                    <option value="normal">Normal</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Status
                  </label>
                  <select
                    value={addLeadForm.status}
                    onChange={(e) => setAddLeadForm((f) => ({ ...f, status: e.target.value as Lead["status"] }))}
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
