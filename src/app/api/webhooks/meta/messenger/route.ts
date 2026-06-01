import { NextResponse } from "next/server";

// ─── GET — Meta webhook verification ─────────────────────────────────────────
// Meta sends a GET with hub.mode, hub.verify_token, hub.challenge when you
// register the webhook URL in the Meta Developer dashboard.
// Respond with hub.challenge as plain text to confirm ownership.
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
    return NextResponse.json({ ok: true }); // 200 — don't trigger retries
  }

  console.log("[meta/messenger] Received event:", JSON.stringify(payload, null, 2));

  // Only handle page events for now
  if (payload.object !== "page") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // payload.entry is an array of page-level event batches
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const messaging = Array.isArray((entry as Record<string, unknown>).messaging)
      ? ((entry as Record<string, unknown>).messaging as Record<string, unknown>[])
      : [];

    for (const event of messaging) {
      // TODO: Parse sender ID and message text
      //   const senderId = event.sender?.id;
      //   const text     = event.message?.text;

      // TODO: Look up or create a lead by Facebook sender ID
      //   - query leads where facebook_sender_id = senderId (column not yet added)
      //   - if no match, create a new lead with source = "facebook"

      // TODO: Insert message into messages table
      //   supabase.from("messages").insert({
      //     lead_id: resolvedLeadId,
      //     channel: "facebook",
      //     direction: "inbound",
      //     body: text,
      //     external_message_id: event.message?.mid,
      //   })

      // TODO: Stamp lead fields (last_message_at, has_unread_messages, needs_response)

      // TODO: Send reply via Meta Send API once reply composer supports Facebook channel
      //   POST https://graph.facebook.com/v19.0/me/messages
      //   { recipient: { id: senderId }, message: { text: replyText } }
      //   Authorization: Bearer META_PAGE_ACCESS_TOKEN

      console.log("[meta/messenger] Messaging event (unhandled):", JSON.stringify(event, null, 2));
    }
  }

  return NextResponse.json({ ok: true });
}
