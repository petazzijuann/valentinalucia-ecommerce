import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Valida que exista una sesión de Supabase real (no solo la presencia de la
 * cookie). `getUser()` verifica el JWT contra Supabase Auth, por lo que una
 * cookie falsificada no pasa este control.
 */
export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

/**
 * Guard para route handlers de admin. Devuelve una respuesta 401 si el usuario
 * no está autenticado, o `null` si puede continuar.
 *
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}
