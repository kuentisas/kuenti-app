import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function PanelLayout({
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

  if (!profile || profile.role !== "colaboradora") redirect("/admin");

  return (
    <AppShell role="colaboradora" nombre={profile.nombre}>
      {children}
    </AppShell>
  );
}
