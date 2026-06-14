import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para Server Components / Route Handlers.
 * Lee y escribe la sesión del usuario vía cookies (respeta RLS).
 */
export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: ignorable si hay middleware
            // refrescando la sesión.
          }
        },
      },
    },
  );
}

/**
 * Cliente admin con service role key. SOLO para uso en el server
 * (API routes). Bypassa RLS: nunca lo expongas al cliente.
 * Lo usamos para escribir auditorías de uso público (sin usuario logueado).
 */
export function createAdminSupabase() {
  return createSupabaseJs(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
