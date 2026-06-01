import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { generateAdminToken, isAdminPasswordSet, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const FROM = process.env.RESEND_FROM ?? "onboarding@resend.dev";
const INBOUND_DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? "";

async function checkAuth(): Promise<boolean> {
  if (!isAdminPasswordSet()) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return token === generateAdminToken();
}

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(body: string): string {
  const bodyHtml = htmlEscape(body).replace(/\n/g, "<br>");
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="background:#0f1c40;padding:24px 32px;border-radius:12px 12px 0 0">
        <p style="color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Onward Systems</p>
        <h1 style="color:white;font-size:20px;margin:0;font-weight:600">Message from Onward Systems</h1>
      </div>
      <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 32px">${bodyHtml}</p>
        <div style="border-top:1px solid #e2e8f0;padding-top:24px">
          <p style="font-size:14px;color:#64748b;margin:0;line-height:1.6">
            Mark Henneberry<br>
            Onward Systems &mdash; Halifax, NS<br>
            <a href="https://www.onwardsystems.ca" style="color:#2563eb;text-decoration:none">onwardsystems.ca</a>
          </p>
        </div>
      </div>
    </div>
  `;
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

  if (!body?.subject?.trim()) {
    return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  }
  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  const subject = body.subject.trim() as string;
  const messageBody = body.body.trim() as string;

  const supabase = createServerSupabaseClient();

  // Fetch lead to get email address
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, name, email")
    .eq("id", id)
    .single();

  if (leadErr || !lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  if (!lead.email) {
    return NextResponse.json({ error: "Lead has no email address." }, { status: 400 });
  }

  // Build reply-to so customer replies land in Resend Receiving and get matched back to this lead
  const replyTo = INBOUND_DOMAIN ? `lead-${id}@${INBOUND_DOMAIN}` : undefined;

  console.log("[email] replyTo:", replyTo);

  // Send email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: emailData, error: emailErr } = await resend.emails.send({
    from: FROM,
    to: lead.email,
    subject,
    html: buildEmailHtml(messageBody),
    ...(replyTo ? { replyTo } : {}),
  });

  if (emailErr) {
    console.error("[admin] resend error:", emailErr);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  const resendId = emailData?.id ?? null;

  // Insert into messages table
  const { data: message, error: msgErr } = await supabase
    .from("messages")
    .insert({
      lead_id: id,
      channel: "email",
      direction: "outbound",
      body: messageBody,
      external_message_id: resendId,
    })
    .select("id, lead_id, channel, direction, body, created_at")
    .single();

  if (msgErr) {
    console.error("[admin] message insert error:", msgErr.message);
    // Email was sent — non-fatal, continue
  }

  // Stamp lead with outbound communication fields (non-fatal)
  const now = new Date().toISOString();
  const { error: leadUpdateErr } = await supabase
    .from("leads")
    .update({
      last_message_at: now,
      last_message_direction: "outbound",
      has_unread_messages: false,
      needs_response: false,
      updated_at: now,
    })
    .eq("id", id);
  if (leadUpdateErr) console.error("[admin] lead stamp error (email):", leadUpdateErr.message);

  // Insert activity (non-fatal)
  const { data: activity, error: actErr } = await supabase
    .from("lead_activities")
    .insert({
      lead_id: id,
      type: "message_sent",
      label: "Email sent to lead",
      metadata: { subject, resend_id: resendId, reply_to: replyTo ?? null },
    })
    .select("id, lead_id, type, label, metadata, created_at")
    .single();

  if (actErr) {
    console.error("[admin] activity insert error:", actErr.message);
  }

  return NextResponse.json({ ok: true, message: message ?? null, activity: activity ?? null });
}
