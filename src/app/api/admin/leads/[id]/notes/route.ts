import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAdminToken, isAdminPasswordSet, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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
    .from("lead_notes")
    .select("id, lead_id, note, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] fetch notes error:", error);
    return NextResponse.json({ error: "Failed to fetch notes." }, { status: 500 });
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

  if (!body?.note?.trim()) {
    return NextResponse.json({ error: "Note text is required." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lead_notes")
    .insert({ lead_id: id, note: body.note.trim() })
    .select("id, lead_id, note, created_at")
    .single();

  if (error) {
    console.error("[admin] insert note error:", error);
    return NextResponse.json({ error: "Failed to save note." }, { status: 500 });
  }

  return NextResponse.json({ data });
}
