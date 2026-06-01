import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAdminToken, isAdminPasswordSet, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const VALID_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "booked",
  "completed",
  "lost",
];

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  booked: "Booked",
  completed: "Completed",
  lost: "Lost",
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
  }

  if ("needs_response" in body) {
    if (typeof body.needs_response !== "boolean") {
      return NextResponse.json({ error: "needs_response must be a boolean." }, { status: 400 });
    }
    updates.needs_response = body.needs_response;
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

  return NextResponse.json({ ok: true });
}
