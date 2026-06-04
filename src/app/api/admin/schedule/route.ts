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

export async function GET(_req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .select("id, lead_id, title, description, event_type, start_at, end_at, status, created_at, updated_at, lead:leads(name, email, phone, source)")
    .order("start_at", { ascending: true });

  if (error) {
    console.error("[admin] fetch schedule events error:", error);
    return NextResponse.json({ error: "Failed to fetch schedule." }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (!body.start_at) {
    return NextResponse.json({ error: "Start date/time is required." }, { status: 400 });
  }
  const eventType = body.event_type ?? "reminder";
  if (!VALID_TYPES.includes(eventType)) {
    return NextResponse.json({ error: "Invalid event type." }, { status: 400 });
  }
  const status = body.status ?? "scheduled";
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .insert({
      lead_id: body.lead_id || null,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      event_type: eventType,
      start_at: body.start_at,
      end_at: body.end_at || null,
      status,
    })
    .select("id, lead_id, title, description, event_type, start_at, end_at, status, created_at, updated_at, lead:leads(name, email, phone, source)")
    .single();

  if (error) {
    console.error("[admin] create schedule event error:", error);
    return NextResponse.json({ error: "Failed to create scheduled item." }, { status: 500 });
  }

  // Activity timeline entry (non-fatal). Include schedule_event_id so the entry
  // can be cleaned up if the event is later deleted.
  if (body.lead_id) {
    const { error: actErr } = await supabase.from("lead_activities").insert({
      lead_id: body.lead_id,
      type: "schedule_event_created",
      label: "Scheduled item created",
      metadata: {
        schedule_event_id: data.id,
        event_type: eventType,
        title: body.title.trim(),
        start_at: body.start_at,
      },
    });
    if (actErr) console.error("[admin] schedule activity insert error:", actErr.message);
  }

  return NextResponse.json({ data }, { status: 201 });
}
