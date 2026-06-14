/**
 * Regenera/siembra una auditoría escribiendo DIRECTO en Supabase (admin),
 * salteando la API y su rate limit. Útil para dev/seed.
 *
 * Uso:
 *   node --env-file=.env.local --import tsx scripts/regen-audit.ts <url> [idExistente]
 *   - Sin idExistente: inserta una auditoría nueva.
 *   - Con idExistente: actualiza esa fila (mantiene el mismo link).
 */
import { createClient } from "@supabase/supabase-js";
import { runAudit } from "@/lib/auditors";
import { AuditProgress, ModuleKey } from "@/lib/types/audit";

const KEYS: ModuleKey[] = [
  "seo",
  "performance",
  "accessibility",
  "security",
  "code",
];

async function main() {
  const url = process.argv[2] ?? "https://pixelforge.com.ar";
  const existingId = process.argv[3];

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  console.log(`Auditando ${url} …`);
  const { scores, results } = await runAudit(url);

  const progress: AuditProgress = {};
  for (const k of KEYS) progress[k] = { status: "done", score: scores[k] };

  if (existingId) {
    const { error } = await admin
      .from("audits")
      .update({ status: "completed", scores, results, progress })
      .eq("id", existingId);
    if (error) throw error;
    console.log(`✓ Actualizada ${existingId} · overall ${scores.overall}`);
  } else {
    const { data, error } = await admin
      .from("audits")
      .insert({
        url: results.meta.normalizedUrl,
        status: "completed",
        scores,
        results,
        progress,
      })
      .select("id")
      .single();
    if (error) throw error;
    console.log(`✓ Creada ${data.id} · overall ${scores.overall}`);
  }
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
