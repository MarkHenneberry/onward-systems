import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAdminToken, isAdminPasswordSet, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const VALID_TYPES = [
  "lead_created", "message_created", "note_added", "status_changed",
  "follow_up_set", "urgency_changed", "calendar_exported",
];

async function checkAuth(): Promise<boolean> {
  if (!isAdminPasswordSet()) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return token === generateAdminToken();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lead_activities")
    .select("id, lead_id, type, label, metadata, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] fetch activities error:", error);
    return NextResponse.json({ error: "Failed to fetch activities." }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body?.type || !body?.label?.trim()) {
    return NextResponse.json({ error: "type and label are required." }, { status: 400 });
  }
  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Invalid activity type." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lead_activities")
    .insert({
      lead_id: id,
      type: body.type,
      label: body.label.trim(),
      metadata: body.metadata ?? null,
    })
    .select("id, lead_id, type, label, metadata, created_at")
    .single();

  if (error) {
    console.error("[admin] insert activity error:", error);
    return NextResponse.json({ error: "Failed to save activity." }, { status: 500 });
  }

  return NextResponse.json({ data });
}
