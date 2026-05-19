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

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, generateAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
