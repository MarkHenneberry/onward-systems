import { cookies } from "next/headers";
import type { Metadata } from "next";
import { generateAdminToken, ADMIN_COOKIE, isAdminPasswordSet } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import PasswordGate from "./_components/PasswordGate";
import AdminDashboard from "./_components/AdminDashboard";
import type { Lead } from "./_components/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin — Onward Systems",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const authenticated = isAdminPasswordSet() && token === generateAdminToken();

  if (!authenticated) {
    return <PasswordGate />;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] failed to fetch leads:", error);
  }

  return <AdminDashboard initialLeads={(data ?? []) as Lead[]} />;
}
