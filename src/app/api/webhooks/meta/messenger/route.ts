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

type FacebookProfile = {
  first_name?: string;
  last_name?: string;
  id?: string;
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

// ─── Profile fetch ────────────────────────────────────────────────────────────
// Calls the Meta User Profile API to get first_name, last_name, profile_pic.
// Returns null on any failure so callers can fall back gracefully.
// META_PAGE_ACCESS_TOKEN is server-side only and never exposed to the client.

async function fetchFacebookUserProfile(senderId: string): Promise<FacebookProfile | null> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    console.warn("[meta/messenger] META_PAGE_ACCESS_TOKEN not set — skipping profile fetch");
    return null;
  }

  try {
    const url = new URL(`https://graph.facebook.com/v19.0/${encodeURIComponent(senderId)}`);
    url.searchParams.set("fields", "first_name,last_name");
    url.searchParams.set("access_token", token);

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[meta/messenger] Profile fetch failed:", res.status, body.slice(0, 200));
      return null;
    }

    const data = (await res.json()) as FacebookProfile;
    console.log("[meta/messenger] Profile fetched for sender:", senderId, "name:", data.first_name, data.last_name);
    return data;
  } catch (err) {
    console.warn("[meta/messenger] Profile fetch error:", err);
    return null;
  }
}

function buildDisplayName(profile: FacebookProfile | null): string {
  if (!profile) return "Facebook User";
  const first = profile.first_name?.trim() ?? "";
  const last  = profile.last_name?.trim() ?? "";
  const full  = [first, last].filter(Boolean).join(" ");
  return full || "Facebook User";
}

// ─── Event handler ────────────────────────────────────────────────────────────

async function handleMessagingEvent(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  event: MessagingEvent
) {
  const senderId    = event.sender?.id;
  const recipientId = event.recipient?.id;
  const message     = event.message;
  const timestamp   = event.timestamp;

  if (!message) return;

  // Echo = a message the Page sent (from the admin hub, Business Suite, or Page
  // Inbox). Log it as an outbound message so the hub stays complete.
  if (message.is_echo) {
    await handleEchoEvent(supabase, event);
    return;
  }

  if (!senderId) return;

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

  // ── Fetch sender profile (best-effort, non-blocking on failure) ────────────

  const profile     = await fetchFacebookUserProfile(senderId);
  const displayName = buildDisplayName(profile);

  // ── Lead matching / creation ───────────────────────────────────────────────

  let leadId: string;

  const { data: existingLead } = await supabase
    .from("leads")
    .select("id, name")
    .eq("facebook_sender_id", senderId)
    .maybeSingle();

  if (existingLead) {
    leadId = existingLead.id;

    // Update name if still the generic placeholder and we resolved a real name.
    const nameIsGeneric = !existingLead.name || existingLead.name === "Facebook User";
    const leadUpdates: Record<string, unknown> = {};
    if (nameIsGeneric && displayName !== "Facebook User") {
      leadUpdates.name = displayName;
    }
    if (Object.keys(leadUpdates).length > 0) {
      const { error: updateErr } = await supabase
        .from("leads")
        .update(leadUpdates)
        .eq("id", leadId);
      if (updateErr) console.warn("[meta/messenger] Lead name/pic update error:", updateErr.message);
    }
  } else {
    const { data: newLead, error: createErr } = await supabase
      .from("leads")
      .insert({
        name:                displayName,
        business_name:       "",
        email:               null,
        phone:               null,
        website_or_facebook: null,
        business_type:       null,
        help_needed:         "Facebook message",
        message:             text,
        source:              "facebook",
        urgency:             "normal",
        status:              "new",
        facebook_sender_id:  senderId,
      })
      .select("id")
      .single();

    if (createErr || !newLead) {
      console.error("[meta/messenger] Failed to create lead:", createErr?.message);
      return;
    }

    leadId = newLead.id;

    await supabase.from("lead_activities").insert({
      lead_id:  leadId,
      type:     "lead_created",
      label:    "Lead created from Facebook",
      metadata: { source: "facebook", sender_id: senderId, name: displayName },
    });
  }

  // ── Save inbound message ───────────────────────────────────────────────────

  const { error: msgErr } = await supabase.from("messages").insert({
    lead_id:             leadId,
    channel:             "facebook",
    direction:           "inbound",
    body:                text,
    external_message_id: mid,
  });
  if (msgErr) console.error("[meta/messenger] Message insert error:", msgErr.message);

  // ── Stamp lead attention fields ────────────────────────────────────────────

  const now = new Date().toISOString();
  const { data: curLead } = await supabase.from("leads").select("unread_count").eq("id", leadId).single();
  const { error: stampErr } = await supabase
    .from("leads")
    .update({
      last_message_at:       now,
      last_message_direction: "inbound",
      has_unread_messages:   true,
      needs_response:        true,
      unread_count:          (curLead?.unread_count ?? 0) + 1,
      updated_at:            now,
    })
    .eq("id", leadId);
  if (stampErr) console.error("[meta/messenger] Lead stamp error:", stampErr.message);

  // ── Activity record ────────────────────────────────────────────────────────

  const { error: actErr } = await supabase.from("lead_activities").insert({
    lead_id:  leadId,
    type:     "message_received",
    label:    "Facebook message received",
    metadata: {
      sender_id:  senderId,
      message_id: mid,
      page_id:    pageId,
      timestamp:  timestamp ?? null,
    },
  });
  if (actErr) console.error("[meta/messenger] Activity insert error:", actErr.message);
}

// ─── Echo handler (Page-sent messages) ────────────────────────────────────────
// Fired for messages the Page sends. These can originate from the admin hub OR
// from Meta Business Suite / Page Inbox. We log them as outbound so the hub stays
// complete, while deduplicating against messages the admin hub already saved.

async function handleEchoEvent(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  event: MessagingEvent
) {
  const message = event.message;
  if (!message) return;

  const senderId = event.sender?.id ?? null;
  const recipientId = event.recipient?.id ?? null;
  const pageId = process.env.META_PAGE_ID ?? null;
  const mid = message.mid ?? null;
  const text = typeof message.text === "string" ? message.text.trim() : null;

  // Resolve the customer PSID. For echoes, sender.id is the Page and
  // recipient.id is the customer. If sender.id matches our Page ID, the
  // customer is recipient.id; otherwise fall back to the id that isn't the Page.
  let customerPsid: string | null;
  if (pageId && senderId === pageId) {
    customerPsid = recipientId;
  } else {
    customerPsid = [senderId, recipientId].find((id) => id && id !== pageId) ?? recipientId;
  }

  console.log(
    "[meta/messenger] Echo event — sender:", senderId,
    "recipient:", recipientId,
    "pageId:", pageId,
    "resolved customer PSID:", customerPsid,
    "mid:", mid
  );

  if (!text) {
    console.log("[meta/messenger] Echo skipped — no text body");
    return;
  }
  if (!customerPsid) {
    console.warn("[meta/messenger] Echo skipped — could not resolve customer PSID");
    return;
  }

  // 1) Dedup by Meta message id
  if (mid) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("external_message_id", mid)
      .maybeSingle();
    if (existing) {
      console.log("[meta/messenger] Echo skipped — duplicate mid already saved:", mid);
      return;
    }
  }

  // Attribute to the lead by the customer's PSID
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("facebook_sender_id", customerPsid)
    .maybeSingle();

  if (!lead) {
    console.warn("[meta/messenger] Echo skipped — no lead for PSID:", customerPsid);
    return;
  }
  const leadId = lead.id;
  console.log("[meta/messenger] Echo matched lead:", leadId);

  // 2) Fallback dedup: the admin hub saves its outbound Facebook reply without a
  // Meta mid. Match a recent identical outbound (same lead/text) within 60s and
  // skip — backfilling the mid so future echoes dedup cleanly.
  const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recentDup } = await supabase
    .from("messages")
    .select("id, external_message_id")
    .eq("lead_id", leadId)
    .eq("channel", "facebook")
    .eq("direction", "outbound")
    .eq("body", text)
    .gte("created_at", sixtySecAgo)
    .limit(1);

  if (recentDup && recentDup.length > 0) {
    if (mid && !recentDup[0].external_message_id) {
      await supabase.from("messages").update({ external_message_id: mid }).eq("id", recentDup[0].id);
    }
    console.log("[meta/messenger] Echo skipped — matches recent admin-hub send (deduped)");
    return;
  }

  // 3) New outbound message sent from Business Suite / Page Inbox — log it
  const { error: msgErr } = await supabase.from("messages").insert({
    lead_id:             leadId,
    channel:             "facebook",
    direction:           "outbound",
    body:                text,
    external_message_id: mid,
    external_thread_id:  customerPsid,
  });
  if (msgErr) {
    console.error("[meta/messenger] Echo message insert error:", msgErr.message);
    return;
  }

  const now = new Date().toISOString();
  const { error: stampErr } = await supabase
    .from("leads")
    .update({
      last_message_at:        now,
      last_message_direction: "outbound",
      has_unread_messages:    false,
      needs_response:         false,
      unread_count:           0,
      updated_at:             now,
    })
    .eq("id", leadId);
  if (stampErr) console.error("[meta/messenger] Echo lead stamp error:", stampErr.message);

  const { error: actErr } = await supabase.from("lead_activities").insert({
    lead_id:  leadId,
    type:     "message_sent",
    label:    "Facebook message sent",
    metadata: { message_id: mid, recipient_psid: customerPsid, source: "page_inbox" },
  });
  if (actErr) console.error("[meta/messenger] Echo activity insert error:", actErr.message);

  console.log("[meta/messenger] Echo saved as outbound for lead:", leadId);
}
