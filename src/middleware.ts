import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login", "/auth/callback"];
const CAMBIAR_PASSWORD_PATH = "/cambiar-password";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user) {
    if (!isPublicPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Usuario autenticado: valida que el perfil siga activo y obtiene su rol.
  const { data: profile } = await supabase
    .from("users")
    .select("role, activo, deleted_at, debe_cambiar_password")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.activo || profile.deleted_at) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "cuenta_inactiva");
    return NextResponse.redirect(url);
  }

  if (isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = profile.role === "colaboradora" ? "/panel" : "/admin";
    return NextResponse.redirect(url);
  }

  // Contraseña temporal asignada por el admin: bloquea toda la app hasta
  // que la cambie. Se evalúa antes que las reglas de /admin y /panel para
  // que ningún rol pueda esquivarlo.
  if (profile.debe_cambiar_password && path !== CAMBIAR_PASSWORD_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = CAMBIAR_PASSWORD_PATH;
    return NextResponse.redirect(url);
  }

  if (!profile.debe_cambiar_password && path === CAMBIAR_PASSWORD_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = profile.role === "colaboradora" ? "/panel" : "/admin";
    return NextResponse.redirect(url);
  }

  // Rentabilidad expone tarifas/salarios — exclusivo admin, incluso
  // dentro de /admin (que supervisor sí puede usar).
  if (path.startsWith("/admin/rentabilidad") && profile.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/admin") && profile.role !== "admin" && profile.role !== "supervisor") {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/panel") && profile.role !== "colaboradora") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
