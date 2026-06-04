import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAdminToken, isAdminPasswordSet, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const VALID_TYPES = ["follow_up", "call", "estimate", "job", "reminder", "other"];
const VALID_STATUSES = ["scheduled", "completed", "cancelled", "missed"];

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
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = body.status;
  }
  if ("title" in body) {
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    }
    updates.title = body.title.trim();
  }
  if ("description" in body) {
    updates.description = body.description?.trim() || null;
  }
  if ("event_type" in body) {
    if (!VALID_TYPES.includes(body.event_type)) {
      return NextResponse.json({ error: "Invalid event type." }, { status: 400 });
    }
    updates.event_type = body.event_type;
  }
  if ("start_at" in body) {
    if (!body.start_at) {
      return NextResponse.json({ error: "Start date/time is required." }, { status: 400 });
    }
    updates.start_at = body.start_at;
  }
  if ("end_at" in body) {
    updates.end_at = body.end_at || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields provided." }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .update(updates)
    .eq("id", id)
    .select("id, lead_id, title, description, event_type, start_at, end_at, status, created_at, updated_at, lead:leads(name, email, phone, source)")
    .single();

  if (error) {
    console.error("[admin] update schedule event error:", error);
    return NextResponse.json({ error: "Failed to update scheduled item." }, { status: 500 });
  }

  // Log a completion activity when the event is marked completed (non-fatal)
  if (body.status === "completed" && data?.lead_id) {
    const { error: actErr } = await supabase.from("lead_activities").insert({
      lead_id: data.lead_id,
      type: "schedule_event_completed",
      label: "Scheduled item completed",
      metadata: {
        schedule_event_id: id,
        title: data.title,
        completed_at: updates.updated_at,
      },
    });
    if (actErr) console.error("[admin] schedule completion activity error:", actErr.message);
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServerSupabaseClient();

  // Remove schedule-related timeline entries first so the lead Timeline stays
  // accurate (no orphaned "Scheduled item created/completed" rows). Non-fatal.
  const { error: actErr } = await supabase
    .from("lead_activities")
    .delete()
    .eq("metadata->>schedule_event_id", id);
  if (actErr) console.error("[admin] delete schedule activities error:", actErr.message);

  const { error } = await supabase.from("schedule_events").delete().eq("id", id);

  if (error) {
    console.error("[admin] delete schedule event error:", error);
    return NextResponse.json({ error: "Failed to delete scheduled item." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
