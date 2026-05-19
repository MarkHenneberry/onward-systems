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

  return NextResponse.json({ ok: true });
}
