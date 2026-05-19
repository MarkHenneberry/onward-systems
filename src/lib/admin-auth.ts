import crypto from "crypto";

export const ADMIN_COOKIE = "admin_token";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function isAdminPasswordSet(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

// Derives a fixed token from the password so the raw password is never stored in the cookie.
// Changing ADMIN_PASSWORD invalidates all existing sessions.
export function generateAdminToken(): string {
  const pwd = process.env.ADMIN_PASSWORD ?? "";
  return crypto
    .createHmac("sha256", pwd || "no-password-set")
    .update("onward-admin-v1")
    .digest("hex");
}
