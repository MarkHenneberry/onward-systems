"use client";

import { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Lead = {
  id: string;
  created_at: string;
  updated_at: string | null;
  name: string;
  business_name: string;
  email: string;
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
};

type LeadNote = {
  id: string;
  lead_id: string;
  note: string;
  created_at: string;
};

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

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.split("T")[0];
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
    `Email: ${lead.email}`,
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
    <div className="flex items-center gap-2">
      <div className="flex gap-3 text-sm flex-1 min-w-0">
        <span className="text-slate-400 w-32 shrink-0">{label}</span>
        <span className="text-slate-700 flex-1 break-words min-w-0">{value}</span>
      </div>
      {action}
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Notes state
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteHistory, setNoteHistory] = useState<LeadNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const selectedLead = leads.find((l) => l.id === selectedId) ?? null;

  // Fetch note history whenever a different lead is selected
  useEffect(() => {
    setNoteDraft("");
    setNoteHistory([]);

    if (!selectedId) return;

    setNotesLoading(true);
    fetch(`/api/admin/leads/${selectedId}/notes`)
      .then((r) => r.json())
      .then(({ data }) => setNoteHistory(data ?? []))
      .catch((err) => console.error("[admin] failed to load notes:", err))
      .finally(() => setNotesLoading(false));
  }, [selectedId]);

  // Overview stats
  const stats = useMemo(() => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return {
      total: leads.length,
      new: leads.filter((l) => l.status === "new").length,
      emergency: leads.filter((l) => l.urgency === "emergency").length,
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
    out.sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "desc" ? -diff : diff;
    });
    return out;
  }, [leads, statusFilter, urgencyFilter, sortDir]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function patchLead(id: string, updates: Partial<Lead>): Promise<boolean> {
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      console.error("[admin] patch failed:", await res.text());
      return false;
    }
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    return true;
  }

  async function handleStatusChange(id: string, status: string) {
    await patchLead(id, { status: status as Lead["status"] });
  }

  async function handleFollowUpChange(id: string, dateValue: string) {
    await patchLead(id, { follow_up_date: dateValue || null });
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
      } else {
        console.error("[admin] save note failed:", await res.text());
      }
    } catch (err) {
      console.error("[admin] save note error:", err);
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin";
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col bg-slate-50"
      style={{ minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* ── Header ── */}
      <header className="bg-[#0f1c40] text-white px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">Onward Systems</span>
          <span className="text-white/30 text-xs">|</span>
          <span className="text-blue-300 text-sm">Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors duration-200"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
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
                { label: "Emergency", value: stats.emergency, Icon: AlertTriangle, color: "text-red-600 bg-red-50" },
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
            <span className="text-xs text-slate-400 ml-auto">
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  {["Name / Business", "Help needed", "Urgency", "Status", "Date", "Contact"].map((h) => (
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
                      <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-slate-600 text-xs">{lead.email}</div>
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
          <div className="w-full lg:w-[420px] bg-white border-l border-slate-100 flex flex-col overflow-hidden shrink-0">
            {/* Panel header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <div className="font-semibold text-[#0f1c40]">{selectedLead.name}</div>
                <div className="text-sm text-slate-500">{selectedLead.business_name}</div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors duration-150 mt-0.5 shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Status + urgency */}
              <div className="flex gap-4 flex-wrap">
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
                    onClick={() => downloadIcs(selectedLead)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors duration-150"
                  >
                    <Calendar size={12} />
                    Add follow-up to calendar
                  </button>
                )}
              </div>

              {/* Contact info */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Contact
                </div>
                <div className="space-y-2.5">
                  <InfoRow
                    label="Email"
                    value={
                      <a href={`mailto:${selectedLead.email}`} className="text-blue-600 hover:underline break-all">
                        {selectedLead.email}
                      </a>
                    }
                    action={
                      <a
                        href={`mailto:${selectedLead.email}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-2 py-1 rounded-lg transition-colors duration-150 shrink-0"
                      >
                        <Mail size={11} />
                        Email
                      </a>
                    }
                  />
                  <InfoRow
                    label="Phone"
                    value={
                      selectedLead.phone ? (
                        <a
                          href={`tel:${cleanPhone(selectedLead.phone)}`}
                          className="text-slate-700 hover:text-blue-600 transition-colors duration-150"
                        >
                          {selectedLead.phone}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                    action={
                      selectedLead.phone ? (
                        <a
                          href={`tel:${cleanPhone(selectedLead.phone)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-400 px-2 py-1 rounded-lg transition-colors duration-150 shrink-0"
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
                      selectedLead.website_or_facebook ? (
                        <a
                          href={
                            selectedLead.website_or_facebook.startsWith("http")
                              ? selectedLead.website_or_facebook
                              : `https://${selectedLead.website_or_facebook}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {selectedLead.website_or_facebook}
                        </a>
                      ) : (
                        "—"
                      )
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
                <div className="space-y-2.5">
                  <InfoRow label="Help needed" value={selectedLead.help_needed || "—"} />
                  <InfoRow label="Submitted" value={formatDate(selectedLead.created_at)} />
                  {selectedLead.updated_at && (
                    <InfoRow label="Updated" value={formatDate(selectedLead.updated_at)} />
                  )}
                  {selectedLead.follow_up_date && (
                    <InfoRow label="Follow-up" value={formatDate(selectedLead.follow_up_date)} />
                  )}
                </div>
                {selectedLead.message && (
                  <div className="mt-4">
                    <div className="text-xs text-slate-400 mb-1.5">Message</div>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-wrap">
                      {selectedLead.message}
                    </p>
                  </div>
                )}
              </div>

              {/* ── Internal notes ── */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                  Internal notes
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
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
                {(notesLoading || noteHistory.length > 0) && (
                  <div className="mt-5">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                      Note history
                    </div>
                    {notesLoading ? (
                      <p className="text-xs text-slate-400">Loading...</p>
                    ) : (
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
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
