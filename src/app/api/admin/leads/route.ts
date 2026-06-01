import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAdminToken, isAdminPasswordSet, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const VALID_STATUSES = ["new", "contacted", "quoted", "booked", "completed", "lost"];
const VALID_URGENCIES = ["emergency", "normal"];
const VALID_SOURCES = ["website", "facebook", "phone", "text", "email", "referral", "manual", "other"];

async function checkAuth(): Promise<boolean> {
  if (!isAdminPasswordSet()) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return token === generateAdminToken();
}

export async function POST(req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (body.urgency && !VALID_URGENCIES.includes(body.urgency)) {
    return NextResponse.json({ error: "Invalid urgency." }, { status: 400 });
  }
  if (body.source && !VALID_SOURCES.includes(body.source)) {
    return NextResponse.json({ error: "Invalid source." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      name: body.name.trim(),
      business_name: body.business_name?.trim() || "",
      email: body.email.trim(),
      phone: body.phone?.trim() || null,
      website_or_facebook: body.website_or_facebook?.trim() || null,
      business_type: body.business_type?.trim() || null,
      help_needed: body.help_needed?.trim() || null,
      message: body.message?.trim() || null,
      urgency: body.urgency ?? "normal",
      status: body.status ?? "new",
      source: body.source ?? "manual",
    })
    .select("*")
    .single();

  if (leadError) {
    console.error("[admin] create lead error:", leadError);
    return NextResponse.json({ error: "Failed to create lead." }, { status: 500 });
  }

  // Insert initial message if a message body was provided (non-fatal)
  if (body.message?.trim()) {
    const channel = VALID_SOURCES.includes(body.source) ? body.source : "manual";
    const { error: msgError } = await supabase
      .from("messages")
      .insert({
        lead_id: lead.id,
        channel,
        direction: "inbound",
        body: body.message.trim(),
      });
    if (msgError) {
      console.error("[admin] message insert on lead create error:", msgError.message);
    }
  }

  return NextResponse.json({ data: lead }, { status: 201 });
}
