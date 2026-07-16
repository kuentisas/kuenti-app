import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/lib/current-user";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "supervisor") redirect("/panel");

  return (
    <AppShell role={profile.role} nombre={profile.nombre}>
      {children}
    </AppShell>
  );
}
