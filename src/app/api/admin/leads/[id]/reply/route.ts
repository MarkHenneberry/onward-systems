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

  if (!body?.channel) {
    return NextResponse.json({ error: "channel is required." }, { status: 400 });
  }
  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  const channel = body.channel as string;
  const messageBody = (body.body as string).trim();

  if (channel === "email") {
    if (!body?.subject?.trim()) {
      return NextResponse.json({ error: "Subject is required for email replies." }, { status: 400 });
    }
    return handleEmailReply(id, (body.subject as string).trim(), messageBody);
  }

  if (channel === "facebook") {
    return handleFacebookReply(id, messageBody);
  }

  // TODO: Add SMS later if Twilio/phone handling becomes part of Tier 3.

  return NextResponse.json(
    { error: `Reply channel "${channel}" is not yet supported.` },
    { status: 400 }
  );
}

async function handleEmailReply(id: string, subject: string, messageBody: string) {
  const supabase = createServerSupabaseClient();

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

  // Reply-To routing: always include the lead tracking address (so customer
  // replies land in Resend Receiving and get matched back to this lead). If
  // EMAIL_REPLY_COPY_TO is set, also CC the owner's normal inbox so replies
  // show up there too. Resend accepts a string or an array for replyTo.
  const trackingAddr = INBOUND_DOMAIN ? `lead-${id}@${INBOUND_DOMAIN}` : null;
  const copyTo = process.env.EMAIL_REPLY_COPY_TO?.trim() || null;
  const replyList = [trackingAddr, copyTo].filter(Boolean) as string[];
  const replyTo = replyList.length === 0 ? undefined : replyList.length === 1 ? replyList[0] : replyList;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: emailData, error: emailErr } = await resend.emails.send({
    from: FROM,
    to: lead.email,
    subject,
    html: buildEmailHtml(messageBody),
    ...(replyTo ? { replyTo } : {}),
  });

  if (emailErr) {
    console.error("[reply] resend error:", emailErr);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  const resendId = emailData?.id ?? null;
  const now = new Date().toISOString();

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

  if (msgErr) console.error("[reply] message insert error:", msgErr.message);

  const { error: leadUpdateErr } = await supabase
    .from("leads")
    .update({
      last_message_at: now,
      last_message_direction: "outbound",
      has_unread_messages: false,
      needs_response: false,
      unread_count: 0,
      updated_at: now,
    })
    .eq("id", id);
  if (leadUpdateErr) console.error("[reply] lead stamp error:", leadUpdateErr.message);

  const { data: activity, error: actErr } = await supabase
    .from("lead_activities")
    .insert({
      lead_id: id,
      type: "message_sent",
      label: "Email reply sent",
      metadata: { subject, resend_id: resendId, reply_to: replyTo ?? null, channel: "email" },
    })
    .select("id, lead_id, type, label, metadata, created_at")
    .single();

  if (actErr) console.error("[reply] activity insert error:", actErr.message);

  return NextResponse.json({ ok: true, message: message ?? null, activity: activity ?? null });
}

// ─── Facebook Messenger reply ─────────────────────────────────────────────────

async function handleFacebookReply(id: string, messageBody: string) {
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageAccessToken) {
    return NextResponse.json(
      { error: "Facebook integration is not configured (META_PAGE_ACCESS_TOKEN missing)." },
      { status: 500 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, facebook_sender_id")
    .eq("id", id)
    .single();

  if (leadErr || !lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  if (!lead.facebook_sender_id) {
    return NextResponse.json(
      { error: "Lead has no Facebook sender ID — a message must be received from them first." },
      { status: 400 }
    );
  }

  // Send via Meta Messenger Send API
  const sendRes = await fetch(
    "https://graph.facebook.com/v19.0/me/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: lead.facebook_sender_id },
        message:   { text: messageBody },
      }),
    }
  );

  if (!sendRes.ok) {
    const errBody = await sendRes.text().catch(() => "");
    console.error("[reply/facebook] Meta Send API error:", sendRes.status, errBody);
    return NextResponse.json({ error: "Failed to send Facebook message." }, { status: 500 });
  }

  const sendData = await sendRes.json().catch(() => ({}));
  const fbMessageId: string | null = (sendData as Record<string, unknown>).message_id as string ?? null;

  const now = new Date().toISOString();

  const { data: message, error: msgErr } = await supabase
    .from("messages")
    .insert({
      lead_id:            id,
      channel:            "facebook",
      direction:          "outbound",
      body:               messageBody,
      external_message_id: fbMessageId,
    })
    .select("id, lead_id, channel, direction, body, created_at")
    .single();

  if (msgErr) console.error("[reply/facebook] Message insert error:", msgErr.message);

  const { error: stampErr } = await supabase
    .from("leads")
    .update({
      last_message_at:       now,
      last_message_direction: "outbound",
      has_unread_messages:   false,
      needs_response:        false,
      unread_count:          0,
      updated_at:            now,
    })
    .eq("id", id);
  if (stampErr) console.error("[reply/facebook] Lead stamp error:", stampErr.message);

  const { data: activity, error: actErr } = await supabase
    .from("lead_activities")
    .insert({
      lead_id:  id,
      type:     "message_sent",
      label:    "Facebook reply sent",
      metadata: {
        channel:    "facebook",
        message_id: fbMessageId,
        sender_id:  lead.facebook_sender_id,
      },
    })
    .select("id, lead_id, type, label, metadata, created_at")
    .single();

  if (actErr) console.error("[reply/facebook] Activity insert error:", actErr.message);

  return NextResponse.json({ ok: true, message: message ?? null, activity: activity ?? null });
}
