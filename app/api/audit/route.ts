import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { runAudit } from "@/lib/auditors";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeUrl } from "@/lib/utils/url";

// Node.js runtime (cheerio, fetch a recursos externos). maxDuration cubre el
// trabajo en background lanzado con waitUntil (Fluid Compute lo mantiene vivo
// después de responder). Vercel: hasta 300s.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Corre el trabajo en segundo plano manteniéndolo vivo tras responder.
 * - En Vercel (serverless/Fluid): waitUntil evita que la función se congele.
 * - En local (next dev) o si no hay scope de request: fallback fire-and-forget,
 *   que funciona porque el proceso de Node es persistente.
 */
function runInBackground(promise: Promise<unknown>) {
  try {
    waitUntil(promise);
  } catch {
    void promise.catch((e) =>
      console.error("[api/audit] background error:", e),
    );
  }
}

/** Corre la auditoría y persiste el resultado (o el fallo) en Supabase. */
async function processAudit(id: string, url: string) {
  const admin = createAdminSupabase();
  try {
    // Cada módulo reporta su estado apenas termina (merge atómico vía RPC).
    const { scores, results } = await runAudit(url, async (key, module) => {
      await admin.rpc("set_audit_progress", {
        p_id: id,
        p_key: key,
        p_payload: {
          status: module.error ? "failed" : "done",
          score: module.score,
        },
      });
    });
    const { error } = await admin
      .from("audits")
      .update({ status: "completed", scores, results })
      .eq("id", id);
    if (error) console.error("[api/audit] update error:", error.message);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido.";
    console.error("[api/audit] audit failed:", message);
    await admin.from("audits").update({ status: "failed" }).eq("id", id);
  }
}

/**
 * POST /api/audit
 * Body: { url: string }
 * Crea la auditoría (status "running"), la dispara en background y responde
 * inmediatamente con el id. El cliente sigue el progreso por polling al
 * GET /api/audit/[id].
 */
export async function POST(req: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      {
        error:
          "Supabase no está configurado. Completá NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY en .env.local.",
      },
      { status: 503 },
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json(
      { error: "Falta el campo 'url'." },
      { status: 400 },
    );
  }

  // Validar / normalizar URL temprano.
  let url: string;
  try {
    url = normalizeUrl(body.url);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "URL inválida." },
      { status: 400 },
    );
  }

  const admin = createAdminSupabase();

  // Identificar usuario (si está logueado) para asociar la auditoría.
  let userId: string | null = null;
  try {
    const supa = createServerSupabase();
    const {
      data: { user },
    } = await supa.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  // Rate limit solo para uso anónimo (público).
  if (!userId) {
    const ip = getClientIp(req.headers);
    const rl = await checkRateLimit(admin, ip);
    if (!rl.allowed) {
      const minutes = Math.ceil(rl.retryAfterMs / 60000);
      return NextResponse.json(
        {
          error: `Límite alcanzado (5 auditorías por hora). Probá de nuevo en ~${minutes} min.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        },
      );
    }
  }

  // Crear la fila en estado "running" para tener un id que devolver/seguir.
  const { data: created, error: insertErr } = await admin
    .from("audits")
    .insert({ url, status: "running", user_id: userId })
    .select("id")
    .single();

  if (insertErr || !created) {
    console.error("[api/audit] insert error:", insertErr?.message);
    return NextResponse.json(
      { error: "No se pudo crear la auditoría." },
      { status: 500 },
    );
  }

  const id = created.id as string;

  // Disparar en background y responder ya. 202 Accepted = "encolado".
  runInBackground(processAudit(id, url));

  return NextResponse.json({ id, status: "running" }, { status: 202 });
}
