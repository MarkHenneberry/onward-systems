import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAdminToken, isAdminPasswordSet, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const VALID_STATUSES = ["prospect", "new", "contacted", "interested", "quoted", "booked", "completed", "lost", "not_a_fit"];
const VALID_URGENCIES = ["emergency", "priority", "normal"];
const VALID_SOURCES = ["website", "facebook", "google", "phone", "text", "email", "referral", "manual", "other"];

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
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] fetch leads error:", error);
    return NextResponse.json({ error: "Failed to fetch leads." }, { status: 500 });
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

  // A lead/prospect needs at least a name or a business name — email/phone optional.
  if (!body.name?.trim() && !body.business_name?.trim()) {
    return NextResponse.json({ error: "A name or business name is required." }, { status: 400 });
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
      name: body.name?.trim() || body.business_name?.trim() || "Untitled",
      business_name: body.business_name?.trim() || "",
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      website_or_facebook: body.website_or_facebook?.trim() || null,
      website_url: body.website_url?.trim() || null,
      facebook_url: body.facebook_url?.trim() || null,
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

  // Manual/prospect leads do NOT create a message thread entry — the Description
  // is stored on the lead (message column) as context, not a real communication.
  // Real inbound messages come from the website form (/api/contact) and webhooks.

  // Insert lead_created activity (non-fatal)
  const sourceName = (body.source ?? "manual");
  const sourceLabel = sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
  const { error: actError } = await supabase
    .from("lead_activities")
    .insert({
      lead_id: lead.id,
      type: "lead_created",
      label: `Lead created from ${sourceLabel}`,
      metadata: { source: body.source ?? "manual" },
    });
  if (actError) {
    console.error("[admin] activity insert on lead create error:", actError.message);
  }

  return NextResponse.json({ data: lead }, { status: 201 });
}
