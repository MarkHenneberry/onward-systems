import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAdminToken, isAdminPasswordSet, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const VALID_CHANNELS = ["website", "facebook", "phone", "text", "email", "referral", "manual", "other"];
const VALID_DIRECTIONS = ["inbound", "outbound", "internal"];

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
    .from("messages")
    .select("id, lead_id, channel, direction, body, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin] fetch messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages." }, { status: 500 });
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

  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }
  if (body.channel && !VALID_CHANNELS.includes(body.channel)) {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }
  if (body.direction && !VALID_DIRECTIONS.includes(body.direction)) {
    return NextResponse.json({ error: "Invalid direction." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      lead_id: id,
      channel: body.channel ?? "manual",
      direction: body.direction ?? "inbound",
      body: body.body.trim(),
    })
    .select("id, lead_id, channel, direction, body, created_at")
    .single();

  if (error) {
    console.error("[admin] insert message error:", error);
    return NextResponse.json({ error: "Failed to save message." }, { status: 500 });
  }

  // Stamp lead with communication fields based on direction (non-fatal)
  const dir = body.direction ?? "inbound";
  const stampNow = new Date().toISOString();
  const leadStamp: Record<string, unknown> = {
    last_message_at: stampNow,
    last_message_direction: dir,
    updated_at: stampNow,
  };
  if (dir === "inbound") {
    leadStamp.has_unread_messages = true;
    leadStamp.needs_response = true;
    // Increment unread_count (read-modify-write; low volume)
    const { data: cur } = await supabase.from("leads").select("unread_count").eq("id", id).single();
    leadStamp.unread_count = (cur?.unread_count ?? 0) + 1;
  } else if (dir === "outbound") {
    leadStamp.has_unread_messages = false;
    leadStamp.needs_response = false;
    leadStamp.unread_count = 0;
  }
  const { error: leadStampErr } = await supabase.from("leads").update(leadStamp).eq("id", id);
  if (leadStampErr) console.error("[admin] lead stamp error (message):", leadStampErr.message);

  // Log activity (non-fatal)
  const ch = body.channel ?? "manual";
  const chLabel = ch.charAt(0).toUpperCase() + ch.slice(1);
  let actLabel: string;
  if (ch === "website" && dir === "inbound") actLabel = "Website message received";
  else if (dir === "outbound") actLabel = `${chLabel} message sent`;
  else if (dir === "internal") actLabel = `${chLabel} internal note logged`;
  else actLabel = `${chLabel} message logged`;

  const { error: actErr } = await supabase
    .from("lead_activities")
    .insert({
      lead_id: id,
      type: "message_created",
      label: actLabel,
      metadata: { channel: ch, direction: dir },
    });
  if (actErr) console.error("[admin] message activity insert error:", actErr.message);

  return NextResponse.json({ data });
}
