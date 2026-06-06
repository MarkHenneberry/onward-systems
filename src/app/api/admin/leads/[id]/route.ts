import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAdminToken, isAdminPasswordSet, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const VALID_STATUSES = [
  "prospect",
  "new",
  "contacted",
  "interested",
  "quoted",
  "booked",
  "completed",
  "lost",
  "not_a_fit",
];

const STATUS_LABELS: Record<string, string> = {
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

const VALID_OUTREACH = [
  "not_contacted", "outreach_sent", "follow_up_needed", "replied",
  "interested", "not_interested", "bad_fit",
];

const OUTREACH_LABELS: Record<string, string> = {
  not_contacted: "Not contacted",
  outreach_sent: "Outreach sent",
  follow_up_needed: "Follow-up needed",
  replied: "Replied",
  interested: "Interested",
  not_interested: "Not interested",
  bad_fit: "Bad fit",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function checkAuth(): Promise<boolean> {
  if (!isAdminPasswordSet()) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return token === generateAdminToken();
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if ("status" in body) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }
    updates.status = body.status;
  }

  if ("notes" in body) {
    updates.notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null;
  }

  if ("follow_up_date" in body) {
    updates.follow_up_date = body.follow_up_date || null;
  }

  if ("has_unread_messages" in body) {
    if (typeof body.has_unread_messages !== "boolean") {
      return NextResponse.json({ error: "has_unread_messages must be a boolean." }, { status: 400 });
    }
    updates.has_unread_messages = body.has_unread_messages;
    // Mark as read / handled clears the unread counter too
    if (body.has_unread_messages === false) updates.unread_count = 0;
  }

  if ("needs_response" in body) {
    if (typeof body.needs_response !== "boolean") {
      return NextResponse.json({ error: "needs_response must be a boolean." }, { status: 400 });
    }
    updates.needs_response = body.needs_response;
  }

  // ── Detail / contact fields ────────────────────────────────────────────────

  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    updates.name = body.name.trim();
  }

  if ("business_name" in body) {
    updates.business_name =
      typeof body.business_name === "string" ? body.business_name.trim() : "";
  }

  if ("email" in body) {
    const v = typeof body.email === "string" ? body.email.trim() : "";
    updates.email = v || null;
  }

  if ("phone" in body) {
    const v = typeof body.phone === "string" ? body.phone.trim() : "";
    updates.phone = v || null;
  }

  if ("website_or_facebook" in body) {
    const v = typeof body.website_or_facebook === "string" ? body.website_or_facebook.trim() : "";
    updates.website_or_facebook = v || null;
  }

  if ("business_type" in body) {
    const v = typeof body.business_type === "string" ? body.business_type.trim() : "";
    updates.business_type = v || null;
  }

  if ("help_needed" in body) {
    const v = typeof body.help_needed === "string" ? body.help_needed.trim() : "";
    updates.help_needed = v || null;
  }

  if ("message" in body) {
    const v = typeof body.message === "string" ? body.message.trim() : "";
    updates.message = v || null;
  }

  if ("urgency" in body) {
    if (!["emergency", "priority", "normal"].includes(body.urgency as string)) {
      return NextResponse.json({ error: "Invalid urgency value." }, { status: 400 });
    }
    updates.urgency = body.urgency;
  }

  // ── Prospecting fields ──────────────────────────────────────────────────────

  if ("fit_score" in body) {
    if (body.fit_score === null) {
      updates.fit_score = null;
    } else {
      const n = Number(body.fit_score);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return NextResponse.json({ error: "fit_score must be an integer 1–5." }, { status: 400 });
      }
      updates.fit_score = n;
    }
  }

  if ("outreach_status" in body) {
    if (!VALID_OUTREACH.includes(body.outreach_status as string)) {
      return NextResponse.json({ error: "Invalid outreach_status." }, { status: 400 });
    }
    updates.outreach_status = body.outreach_status;
  }

  if ("prospect_checklist" in body) {
    if (typeof body.prospect_checklist !== "object" || body.prospect_checklist === null || Array.isArray(body.prospect_checklist)) {
      return NextResponse.json({ error: "prospect_checklist must be an object." }, { status: 400 });
    }
    updates.prospect_checklist = body.prospect_checklist;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields provided." }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("leads").update(updates).eq("id", id);

  if (error) {
    console.error("[admin] lead update error:", error);
    return NextResponse.json({ error: "Failed to update lead." }, { status: 500 });
  }

  // ── Log activities (non-fatal) ──────────────────────────────────────────────

  // Status change — client passes _prev_status so we can show "from X to Y"
  if ("status" in body) {
    const prevStatus = typeof body._prev_status === "string" ? body._prev_status : null;
    const fromLabel = prevStatus ? (STATUS_LABELS[prevStatus] ?? prevStatus) : null;
    const toLabel = STATUS_LABELS[body.status] ?? body.status;
    const label = fromLabel && fromLabel !== toLabel
      ? `Status changed from ${fromLabel} to ${toLabel}`
      : `Status set to ${toLabel}`;
    const { error: actErr } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: id,
        type: "status_changed",
        label,
        metadata: { from: prevStatus, to: body.status },
      });
    if (actErr) console.error("[admin] status activity insert error:", actErr.message);
  }

  // Urgency change — client passes _prev_urgency; only log when it actually changed
  if ("urgency" in body) {
    const prevUrgency = typeof body._prev_urgency === "string" ? body._prev_urgency : null;
    if (prevUrgency && prevUrgency !== body.urgency) {
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      const { error: actErr } = await supabase
        .from("lead_activities")
        .insert({
          lead_id: id,
          type: "urgency_changed",
          label: `Urgency changed from ${cap(prevUrgency)} to ${cap(body.urgency)}`,
          metadata: { from: prevUrgency, to: body.urgency },
        });
      if (actErr) console.error("[admin] urgency activity insert error:", actErr.message);
    }
  }

  // Follow-up date change
  if ("follow_up_date" in body) {
    let label: string;
    if (body.follow_up_date) {
      const parts = (body.follow_up_date as string).split("-");
      const formatted = `${MONTHS[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}, ${parts[0]}`;
      label = `Follow-up set for ${formatted}`;
    } else {
      label = "Follow-up date cleared";
    }
    const { error: actErr } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: id,
        type: "follow_up_set",
        label,
        metadata: { date: body.follow_up_date || null },
      });
    if (actErr) console.error("[admin] follow-up activity insert error:", actErr.message);
  }

  // Outreach status change — client passes _prev_outreach_status; only log when changed.
  // (Log-outreach saves omit _prev_outreach_status so they stay a single clean entry.)
  if ("outreach_status" in body && "_prev_outreach_status" in body) {
    const prev = body._prev_outreach_status as string | null;
    if (prev && prev !== body.outreach_status) {
      const { error: actErr } = await supabase.from("lead_activities").insert({
        lead_id: id,
        type: "outreach_status_changed",
        label: `Outreach status changed from ${OUTREACH_LABELS[prev] ?? prev} to ${OUTREACH_LABELS[body.outreach_status] ?? body.outreach_status}`,
        metadata: { from: prev, to: body.outreach_status },
      });
      if (actErr) console.error("[admin] outreach_status activity insert error:", actErr.message);
    }
  }

  // Fit score change — client passes _prev_fit_score; only log when changed.
  if ("fit_score" in body && "_prev_fit_score" in body) {
    const prev = body._prev_fit_score ?? null;
    const next = updates.fit_score ?? null;
    if (prev !== next) {
      const label = next === null
        ? "Fit score cleared"
        : `Fit score changed from ${prev ?? "–"} to ${next}`;
      const { error: actErr } = await supabase.from("lead_activities").insert({
        lead_id: id,
        type: "fit_score_changed",
        label,
        metadata: { from: prev, to: next },
      });
      if (actErr) console.error("[admin] fit_score activity insert error:", actErr.message);
    }
  }

  // Help needed quick edit — client passes _prev_help_needed; logs a dedicated entry
  // and is excluded from the generic "Lead details updated" below to avoid double logging.
  let helpHandled = false;
  if ("help_needed" in body && "_prev_help_needed" in body) {
    const prev = (body._prev_help_needed ?? null) as string | null;
    const next = (updates.help_needed ?? null) as string | null;
    if ((prev ?? "") !== (next ?? "")) {
      const { error: actErr } = await supabase.from("lead_activities").insert({
        lead_id: id,
        type: "lead_updated",
        label: "Help needed updated",
        metadata: { field: "help_needed", from: prev, to: next },
      });
      if (actErr) console.error("[admin] help_needed activity insert error:", actErr.message);
    }
    helpHandled = true;
  }

  // Detail fields update (generic) — excludes help_needed when handled above
  const DETAIL_FIELDS = [
    "name", "business_name", "email", "phone",
    "website_or_facebook", "business_type", "help_needed", "message", "urgency",
  ];
  const changedDetails = DETAIL_FIELDS.filter((f) => f in body && !(f === "help_needed" && helpHandled));
  if (changedDetails.length > 0) {
    const { error: actErr } = await supabase.from("lead_activities").insert({
      lead_id: id,
      type: "lead_updated",
      label: "Lead details updated",
      metadata: { fields: changedDetails },
    });
    if (actErr) console.error("[admin] lead_updated activity insert error:", actErr.message);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Invalid lead ID." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  // Child records (messages, lead_notes, lead_activities) are removed via
  // ON DELETE CASCADE on their lead_id foreign keys. See SQL instructions.
  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) {
    console.error("[admin] delete lead error:", error);
    return NextResponse.json({ error: "Failed to delete lead." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
