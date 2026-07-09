import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("nombre, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/panel");

  return (
    <AppShell role="admin" nombre={profile.nombre}>
      {children}
    </AppShell>
  );
}
