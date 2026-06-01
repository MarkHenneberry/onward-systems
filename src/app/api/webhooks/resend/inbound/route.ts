import { NextResponse } from "next/server";
import { Resend, type EmailReceivedEvent } from "resend";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const INBOUND_DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? "";

// Regex matches: lead-<uuid>@<anything>
// UUID format: 8-4-4-4-12 hex chars
const LEAD_ADDRESS_RE = /^lead-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i;

function extractLeadId(toAddresses: string[]): string | null {
  for (const addr of toAddresses) {
    const m = addr.match(LEAD_ADDRESS_RE);
    if (m) return m[1];
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  // Read raw body before any parsing — needed for signature verification
  const rawBody = await req.text();

  // Webhook signature verification using the built-in Resend SDK verifier.
  // Set RESEND_WEBHOOK_SECRET in .env.local to enable — required in production.
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    // Resend uses Svix for webhook signing. The SDK's verify() expects
    // the three Svix headers extracted into a plain object (not the Web API Headers).
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("[inbound] missing Svix signature headers");
      return NextResponse.json({ error: "Missing signature headers." }, { status: 400 });
    }

    const resendForVerify = new Resend(process.env.RESEND_API_KEY);
    try {
      resendForVerify.webhooks.verify({
        payload: rawBody,
        headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
        webhookSecret,
      });
    } catch (err) {
      console.error("[inbound] webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }
  } else {
    // TODO: Set RESEND_WEBHOOK_SECRET before going to production.
    // Without this, any POST to this endpoint is accepted.
    console.warn("[inbound] RESEND_WEBHOOK_SECRET is not set — skipping webhook signature verification.");
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Only process inbound email events
  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const typedEvent = event as unknown as EmailReceivedEvent;
  const { email_id: emailId, to: toAddresses } = typedEvent.data;

  if (!emailId) {
    console.error("[inbound] missing email_id in webhook payload");
    return NextResponse.json({ ok: true }); // 200 — don't retry
  }

  // Try to resolve the lead ID from the `to` addresses in the webhook event.
  // The to[] in EmailReceivedEvent does not include the full body, but it does
  // include the recipient addresses, which is all we need for lead matching.
  let leadId = extractLeadId(toAddresses ?? []);

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Fetch full email content via Resend Receiving API.
  // The webhook event does not include text/html body — only the full get() does.
  const { data: emailData, error: fetchErr } = await resend.emails.receiving.get(emailId);

  if (fetchErr || !emailData) {
    console.error("[inbound] failed to fetch received email:", emailId, fetchErr);
    return NextResponse.json({ ok: true }); // 200 — don't retry
  }

  // If lead ID was not in the webhook to[], try the fetched email's to[]
  if (!leadId) {
    leadId = extractLeadId(emailData.to ?? []);
  }

  if (!leadId) {
    const toList = [...(toAddresses ?? []), ...(emailData.to ?? [])].join(", ");
    console.error("[inbound] could not resolve lead id from received email:", emailId, "to:", toList);
    if (!INBOUND_DOMAIN) {
      console.error("[inbound] RESEND_INBOUND_DOMAIN is not set — lead-routing addresses cannot be matched.");
    }
    return NextResponse.json({ ok: true }); // 200 — don't retry
  }

  // Build the message body from text or stripped HTML
  const bodyText =
    (emailData.text?.trim()) ||
    (emailData.html ? stripHtml(emailData.html) : "") ||
    "[No message body]";

  const fromAddress = emailData.from ?? "";
  const subject = emailData.subject ?? "(no subject)";

  const supabase = createServerSupabaseClient();

  // Guard against duplicate webhook deliveries — Resend retries on non-2xx
  const { data: existing } = await supabase
    .from("messages")
    .select("id")
    .eq("external_message_id", emailId)
    .maybeSingle();

  if (existing) {
    console.log("[inbound] duplicate webhook — already processed email:", emailId);
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Save inbound message
  const { error: msgErr } = await supabase.from("messages").insert({
    lead_id: leadId,
    channel: "email",
    direction: "inbound",
    body: bodyText,
    external_message_id: emailId,
  });

  if (msgErr) {
    console.error("[inbound] message insert error:", msgErr.message);
    // Don't fail the webhook — fall through to activity
  }

  // Log activity
  const { error: actErr } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    type: "message_received",
    label: "Email reply received",
    metadata: { from: fromAddress, subject, email_id: emailId },
  });

  if (actErr) {
    console.error("[inbound] activity insert error:", actErr.message);
  }

  return NextResponse.json({ ok: true });
}
