import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateAdminToken,
  isAdminPasswordSet,
  ADMIN_COOKIE,
  COOKIE_MAX_AGE,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  if (!isAdminPasswordSet()) {
    return NextResponse.json(
      { error: "Admin access is not configured." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));

  if (body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  // Mark the cookie Secure only when the request actually arrived over HTTPS.
  // Deployed admin (HTTPS) stays Secure; local access over http://192.168.x.x:3000
  // (dev or a local production build) can still set the cookie, since browsers
  // drop Secure cookies on plain HTTP.
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const isHttps = forwardedProto
    ? forwardedProto.split(",")[0].trim() === "https"
    : new URL(req.url).protocol === "https:";

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, generateAdminToken(), {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
