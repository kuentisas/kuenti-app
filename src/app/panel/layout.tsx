import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/lib/current-user";
import { AppShell } from "@/components/app-shell";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) redirect("/login");
  if (profile.role !== "colaboradora") redirect("/admin");

  return (
    <AppShell role="colaboradora" nombre={profile.nombre}>
      {children}
    </AppShell>
  );
}
