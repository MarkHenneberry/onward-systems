import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const FROM = process.env.RESEND_FROM ?? "onboarding@resend.dev";
const OWNER = "markhenneberry@onwardsystems.ca";

const URGENCY_KEYWORDS = [
  "emergency", "urgent", "asap", "no heat", "leaking", "leak", "storm damage",
];

function detectUrgency(service?: string, message?: string): "emergency" | "normal" {
  const haystack = `${service ?? ""} ${message ?? ""}`.toLowerCase();
  return URGENCY_KEYWORDS.some((kw) => haystack.includes(kw)) ? "emergency" : "normal";
}

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, business, email, phone, website, businessType, service, message, _trap } = body;

  // Honeypot — silently accept without processing
  if (_trap) return NextResponse.json({ ok: true });

  // Validation
  if (!name?.trim() || !business?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const urgency = detectUrgency(service, message);

  // ── 1. Save lead to Supabase ──────────────────────────────────────────────
  try {
    // Diagnose env vars (log presence only, never log key values)
    console.log("[supabase] NEXT_PUBLIC_SUPABASE_URL set:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("[supabase] SUPABASE_SERVICE_ROLE_KEY set:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    const supabase = createServerSupabaseClient();

    const payload = {
      name: name.trim(),
      business_name: business.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      website_or_facebook: website?.trim() || null,
      business_type: businessType?.trim() || null,
      help_needed: service?.trim() || null,
      message: message?.trim() || null,
      urgency,
      status: "new",
      source: "onward_website",
    };

    console.log("[supabase] inserting payload:", JSON.stringify(payload));

    const { data, error: dbError, status, statusText } = await supabase
      .from("leads")
      .insert(payload)
      .select("id")
      .single();

    console.log("[supabase] response status:", status, statusText);

    if (dbError) {
      console.error("[supabase] insert error — code:", dbError.code);
      console.error("[supabase] insert error — message:", dbError.message);
      console.error("[supabase] insert error — details:", dbError.details);
      console.error("[supabase] insert error — hint:", dbError.hint);
      return NextResponse.json(
        { error: "We couldn't save your request. Please try again or email markhenneberry@onwardsystems.ca directly." },
        { status: 500 }
      );
    }

    console.log("[supabase] insert succeeded, lead id:", data?.id);
  } catch (err) {
    console.error("[supabase] client/network error:", err);
    return NextResponse.json(
      { error: "We couldn't save your request. Please try again or email markhenneberry@onwardsystems.ca directly." },
      { status: 500 }
    );
  }

  // ── 2. Send emails ────────────────────────────────────────────────────────
  try {
    const firstName = name.trim().split(" ")[0];

    const rows: [string, string][] = [
      ["Name", name],
      ["Business", business],
      ["Email", email],
      ["Phone", phone || "Not provided"],
      ["Website / Facebook", website || "Not provided"],
      ["Business type", businessType || "Not provided"],
      ["Help needed", service || "Not provided"],
      ["Message", message || "None"],
    ];

    const urgencyBanner =
      urgency === "emergency"
        ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#b91c1c;font-weight:600;">
            ⚠ URGENT / EMERGENCY — respond as soon as possible
           </div>`
        : "";

    await resend.emails.send({
      from: FROM,
      to: OWNER,
      subject: urgency === "emergency"
        ? `🚨 URGENT lead: ${business} (${name})`
        : `New review request: ${business} (${name})`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
          <div style="background:#0f1c40;padding:24px 32px;border-radius:12px 12px 0 0">
            <p style="color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Onward Systems</p>
            <h1 style="color:white;font-size:20px;margin:0;font-weight:600">New Systems Review Request</h1>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
            ${urgencyBanner}
            <table style="width:100%;border-collapse:collapse">
              ${rows
                .map(
                  ([label, value]) => `
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#64748b;width:160px;vertical-align:top;border-bottom:1px solid #f1f5f9">${label}</td>
                  <td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;border-bottom:1px solid #f1f5f9">${value}</td>
                </tr>`
                )
                .join("")}
            </table>
          </div>
        </div>
      `,
    });

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Got your request, ${firstName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
          <div style="background:#0f1c40;padding:24px 32px;border-radius:12px 12px 0 0">
            <p style="color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Onward Systems</p>
            <h1 style="color:white;font-size:20px;margin:0;font-weight:600">Request received.</h1>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
            <p style="font-size:16px;margin:0 0 16px;color:#0f172a">Hi ${firstName},</p>
            <p style="font-size:15px;line-height:1.65;color:#475569;margin:0 0 16px">
              Got your request. I will take a look at what you sent and follow up within 1 to 2 business days with clear notes on where things stand.
            </p>
            <p style="font-size:15px;line-height:1.65;color:#475569;margin:0 0 32px">
              If anything is urgent in the meantime, feel free to call or text: <a href="tel:+19027189304" style="color:#2563eb;text-decoration:none">902-718-9304</a>.
            </p>
            <div style="border-top:1px solid #e2e8f0;padding-top:24px">
              <p style="font-size:14px;color:#64748b;margin:0;line-height:1.6">
                Mark Henneberry<br>
                Onward Systems &mdash; Halifax, NS<br>
                <a href="https://www.onwardsystems.ca" style="color:#2563eb;text-decoration:none">onwardsystems.ca</a>
              </p>
            </div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again or email markhenneberry@onwardsystems.ca directly." },
      { status: 500 }
    );
  }
}
