import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
  };
};

// ─── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error("[meta/messenger] META_VERIFY_TOKEN is not set — cannot verify webhook");
    return new Response("Webhook not configured.", { status: 403 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[meta/messenger] Webhook verified by Meta");
    return new Response(challenge ?? "", { status: 200 });
  }

  console.warn("[meta/messenger] Verification failed — mode:", mode, "token match:", token === verifyToken);
  return new Response("Forbidden.", { status: 403 });
}

// ─── POST — Incoming Messenger events ────────────────────────────────────────
// Meta delivers all subscribed page events here. Respond 200 quickly;
// any non-2xx causes Meta to retry for up to 24 hours.

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    console.error("[meta/messenger] Failed to parse POST body");
    return NextResponse.json({ ok: true });
  }

  if (payload.object !== "page") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = createServerSupabaseClient();
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const messaging: MessagingEvent[] = Array.isArray(
      (entry as Record<string, unknown>).messaging
    )
      ? ((entry as Record<string, unknown>).messaging as MessagingEvent[])
      : [];

    for (const event of messaging) {
      await handleMessagingEvent(supabase, event).catch((err) =>
        console.error("[meta/messenger] handleMessagingEvent error:", err)
      );
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── Event handler ────────────────────────────────────────────────────────────

async function handleMessagingEvent(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  event: MessagingEvent
) {
  const senderId    = event.sender?.id;
  const recipientId = event.recipient?.id;   // the Page ID
  const message     = event.message;
  const timestamp   = event.timestamp;

  if (!senderId || !message) return;

  // Skip echo messages (events for messages sent BY the page)
  if (message.is_echo) return;

  // Skip non-text messages for now
  const text = typeof message.text === "string" ? message.text.trim() : null;
  if (!text) {
    console.log("[meta/messenger] Skipping non-text message from sender:", senderId);
    return;
  }

  const mid    = message.mid ?? null;
  const pageId = recipientId ?? process.env.META_PAGE_ID ?? null;

  // ── Deduplication ──────────────────────────────────────────────────────────

  if (mid) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("external_message_id", mid)
      .maybeSingle();

    if (existing) {
      console.log("[meta/messenger] Duplicate — already processed mid:", mid);
      return;
    }
  }

  // ── Lead matching / creation ───────────────────────────────────────────────

  let leadId: string;

  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("facebook_sender_id", senderId)
    .maybeSingle();

  if (existingLead) {
    leadId = existingLead.id;
  } else {
    // New Facebook lead — no email/phone yet; those can be filled in by the admin later.
    const { data: newLead, error: createErr } = await supabase
      .from("leads")
      .insert({
        name: "Facebook User",
        business_name: "",
        email: null,
        phone: null,
        website_or_facebook: `https://facebook.com/${senderId}`,
        business_type: null,
        help_needed: "Facebook message",
        message: text,
        source: "facebook",
        urgency: "normal",
        status: "new",
        facebook_sender_id: senderId,
      })
      .select("id")
      .single();

    if (createErr || !newLead) {
      console.error("[meta/messenger] Failed to create lead:", createErr?.message);
      return;
    }

    leadId = newLead.id;

    // Lead created activity
    await supabase.from("lead_activities").insert({
      lead_id: leadId,
      type: "lead_created",
      label: "Lead created from Facebook",
      metadata: { source: "facebook", sender_id: senderId },
    });
  }

  // ── Save inbound message ───────────────────────────────────────────────────

  const { error: msgErr } = await supabase.from("messages").insert({
    lead_id: leadId,
    channel: "facebook",
    direction: "inbound",
    body: text,
    external_message_id: mid,
  });

  if (msgErr) {
    console.error("[meta/messenger] Message insert error:", msgErr.message);
    // Non-fatal — continue to stamp + activity
  }

  // ── Stamp lead attention fields ────────────────────────────────────────────

  const now = new Date().toISOString();
  const { error: stampErr } = await supabase
    .from("leads")
    .update({
      last_message_at: now,
      last_message_direction: "inbound",
      has_unread_messages: true,
      needs_response: true,
      updated_at: now,
    })
    .eq("id", leadId);
  if (stampErr) console.error("[meta/messenger] Lead stamp error:", stampErr.message);

  // ── Activity record ────────────────────────────────────────────────────────

  const { error: actErr } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    type: "message_received",
    label: "Facebook message received",
    metadata: {
      sender_id:  senderId,
      message_id: mid,
      page_id:    pageId,
      timestamp:  timestamp ?? null,
    },
  });
  if (actErr) console.error("[meta/messenger] Activity insert error:", actErr.message);
}
