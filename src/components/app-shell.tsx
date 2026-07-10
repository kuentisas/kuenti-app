"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  BarChart3,
  TrendingUp,
  LogOut,
  Clock,
  CalendarRange,
  CalendarDays,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/admin/rentabilidad", label: "Rentabilidad", icon: TrendingUp },
  { href: "/admin/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/admin/clientes", label: "Clientes", icon: Building2 },
  { href: "/admin/usuarios", label: "Equipo", icon: Users },
];

const COLABORADORA_NAV: NavItem[] = [
  { href: "/panel", label: "Mis clientes", icon: Clock },
  { href: "/panel/resumen", label: "Resumen del mes", icon: CalendarRange },
  { href: "/panel/calendario", label: "Calendario", icon: CalendarDays },
];

export function AppShell({
  role,
  nombre,
  children,
}: {
  role: "admin" | "colaboradora";
  nombre: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = role === "admin" ? ADMIN_NAV : COLABORADORA_NAV;

  return (
    <div className="flex min-h-screen bg-kuenti-bg">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white md:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Image
            src="/logo.png"
            alt="Kuenti"
            width={548}
            height={164}
            className="h-9 w-auto"
            priority
          />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active =
              item.href === "/admin" || item.href === "/panel"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-kuenti-slate text-white"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-8">
          <div className="flex items-center md:hidden">
            <Image
              src="/logo.png"
              alt="Kuenti"
              width={548}
              height={164}
              className="h-8 w-auto"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{nombre}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {nombre.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
        <nav className="flex items-center justify-around border-t bg-white p-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-3 py-1.5 text-xs",
                pathname === item.href
                  ? "text-kuenti-slate"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
