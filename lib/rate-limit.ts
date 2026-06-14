import { SupabaseClient } from "@supabase/supabase-js";

const MAX_PER_WINDOW = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hora

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** Extrae la IP del request mirando los headers que setea Vercel. */
export function getClientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/**
 * Rate limit por IP usando la tabla audit_rate_limit en Supabase.
 * Máximo 5 auditorías por IP por hora. Usa el cliente admin (service role).
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  ip: string,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { data, error } = await admin
    .from("audit_rate_limit")
    .select("created_at")
    .eq("ip", ip)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  // Si la tabla falla, no bloqueamos al usuario (fail-open), pero lo logueamos.
  if (error) {
    console.error("[rate-limit] error consultando:", error.message);
    return { allowed: true, remaining: MAX_PER_WINDOW, retryAfterMs: 0 };
  }

  const count = data?.length ?? 0;
  if (count >= MAX_PER_WINDOW) {
    const oldest = new Date(data![0].created_at).getTime();
    const retryAfterMs = Math.max(0, oldest + WINDOW_MS - Date.now());
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  // Registrar este hit.
  await admin.from("audit_rate_limit").insert({ ip });
  return {
    allowed: true,
    remaining: MAX_PER_WINDOW - count - 1,
    retryAfterMs: 0,
  };
}
