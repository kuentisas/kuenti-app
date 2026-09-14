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

  // Accesible a los 3 roles: admin y supervisor llegan acá vía el link
  // "Mi tiempo" de su propio menú, no solo colaboradora. Se pasa el rol
  // real (no hardcodeado) para que AppShell les muestre su propio menú
  // de navegación en vez del de colaboradora.
  return (
    <AppShell role={profile.role} nombre={profile.nombre}>
      {children}
    </AppShell>
  );
}
