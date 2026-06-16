import { NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/lib/auditors";
import { AuditResult } from "@/lib/types/audit";
import { normalizeUrl } from "@/lib/utils/url";

// Node.js runtime (cheerio, fetch a recursos externos). El motor tiene un
// timeout interno de 30s; maxDuration da margen para responder. Vercel: hasta 300s.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/audit
 * Body: { url: string }
 * Corre la auditoría de forma síncrona y devuelve el reporte completo en la
 * misma respuesta. Sin persistencia: el resultado es efímero (no hay historial).
 */
export async function POST(req: NextRequest) {
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

  try {
    const { scores, results } = await runAudit(url);
    const payload: AuditResult = { url, status: "completed", scores, results };
    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido.";
    console.error("[api/audit] audit failed:", message);
    const payload: AuditResult = {
      url,
      status: "failed",
      scores: null,
      results: null,
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
