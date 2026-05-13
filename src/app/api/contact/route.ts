import { NextResponse } from "next/server";
import { Resend } from "resend";

const FROM = process.env.RESEND_FROM ?? "onboarding@resend.dev";
const OWNER = "markhenneberry@onwardsystems.ca";

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const body = await req.json();
    const { name, business, email, phone, website, businessType, service, message, _trap } = body;

    if (_trap) return NextResponse.json({ ok: true });

    if (!name?.trim() || !business?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const firstName = name.split(" ")[0];

    const rows = [
      ["Name", name],
      ["Business", business],
      ["Email", email],
      ["Phone", phone || "Not provided"],
      ["Website / Facebook", website || "Not provided"],
      ["Business type", businessType || "Not provided"],
      ["Help needed", service || "Not provided"],
      ["Message", message || "None"],
    ];

    await resend.emails.send({
      from: FROM,
      to: OWNER,
      subject: `New review request: ${business} (${name})`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
          <div style="background:#0f1c40;padding:24px 32px;border-radius:12px 12px 0 0">
            <p style="color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Onward Systems</p>
            <h1 style="color:white;font-size:20px;margin:0;font-weight:600">New Systems Review Request</h1>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
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
    console.error("Contact form error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again or email directly at markhenneberry@onwardsystems.ca." },
      { status: 500 }
    );
  }
}
