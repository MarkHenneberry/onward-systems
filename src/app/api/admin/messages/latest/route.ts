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

// Returns the single most recent message for each lead, used to render the
// Inbox conversation previews. Reduces the message list (newest first) to one
// row per lead in JS — PostgREST has no clean DISTINCT ON.
export async function GET(_req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, lead_id, channel, direction, body, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("[admin] fetch latest messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages." }, { status: 500 });
  }

  const seen = new Set<string>();
  const latest = [];
  for (const m of data ?? []) {
    if (m.lead_id && !seen.has(m.lead_id)) {
      seen.add(m.lead_id);
      latest.push(m);
    }
  }

  return NextResponse.json({ data: latest });
}
