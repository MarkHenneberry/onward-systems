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

// Strips quoted reply content from an inbound email plain-text body,
// keeping only the customer's new text at the top.
// Falls back to the full body if nothing survives the strip.
function cleanEmailReply(rawBody: string): string {
  if (!rawBody.trim()) return rawBody;

  const body = rawBody.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = body.split("\n");
  const keepLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Hard dividers
    if (/^-{3,}\s*Original Message\s*-{3,}/i.test(trimmed)) break;
    if (/^_{5,}/.test(trimmed)) break;

    // "On [date], [name] wrote:" — Gmail / Apple Mail / single-line Outlook
    if (/^On .+wrote:\s*$/i.test(trimmed)) break;

    // Multi-line "On ... wrote:" — Gmail sometimes wraps the header across 2–3 lines
    if (/^On /i.test(trimmed)) {
      const lookahead = lines.slice(i, Math.min(i + 4, lines.length)).join(" ");
      if (/wrote:\s*$/.test(lookahead)) break;
    }

    // Outlook-style header block: "From:" at line start after a blank line,
    // followed by "Sent:", "To:", or "Subject:" within the next few lines.
    // The blank-line + sibling-header guard prevents false positives in normal prose.
    if (/^From:\s+/i.test(trimmed)) {
      const prevBlank =
        keepLines.length === 0 || keepLines[keepLines.length - 1].trim() === "";
      const upcoming = lines
        .slice(i + 1, Math.min(i + 5, lines.length))
        .map((l) => l.trim());
      const hasHeaderSibling = upcoming.some((l) =>
        /^(Sent|To|Subject):\s+/i.test(l)
      );
      if (prevBlank && hasHeaderSibling) break;
    }

    // Lines prefixed with ">" are quoted text in most clients
    if (/^>/.test(trimmed)) break;

    keepLines.push(line);
  }

  const cleaned = keepLines.join("\n").trim();
  return cleaned || body.trim();
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
  const rawBodyText =
    emailData.text?.trim() ||
    (emailData.html ? stripHtml(emailData.html) : "") ||
    "[No message body]";

  // Strip quoted reply sections — keep only the customer's new text
  const cleanedBody = cleanEmailReply(rawBodyText);

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

  // Save inbound message — store only the cleaned reply, not the quoted thread
  const { error: msgErr } = await supabase.from("messages").insert({
    lead_id: leadId,
    channel: "email",
    direction: "inbound",
    body: cleanedBody,
    external_message_id: emailId,
  });

  if (msgErr) {
    console.error("[inbound] message insert error:", msgErr.message);
    // Don't fail the webhook — fall through to lead stamp + activity
  }

  // Stamp lead as having an unread inbound message (non-fatal)
  const inboundNow = new Date().toISOString();
  const { error: leadStampErr } = await supabase
    .from("leads")
    .update({
      last_message_at: inboundNow,
      last_message_direction: "inbound",
      has_unread_messages: true,
      needs_response: true,
      updated_at: inboundNow,
    })
    .eq("id", leadId);
  if (leadStampErr) console.error("[inbound] lead stamp error:", leadStampErr.message);

  // Log activity
  const { error: actErr } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    type: "message_received",
    label: "Email reply received",
    // TODO: store rawBodyText here if you ever need the full quoted thread for audit purposes
    metadata: { from: fromAddress, subject, email_id: emailId },
  });

  if (actErr) {
    console.error("[inbound] activity insert error:", actErr.message);
  }

  return NextResponse.json({ ok: true });
}
