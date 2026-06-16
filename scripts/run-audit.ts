/**
 * Runner local del motor de auditoría.
 *
 * Corre runAudit() contra una URL real e imprime el progreso por módulo en
 * vivo (en el orden real en que terminan), seguido del resumen de scores y los
 * principales hallazgos. Solo necesita internet y, para
 * Performance/Accesibilidad, la GOOGLE_PAGESPEED_API_KEY de .env.local.
 *
 * Uso:
 *   pnpm audit:url https://vercel.com
 *   pnpm audit:url            # usa https://example.com por defecto
 */
import { runAudit } from "@/lib/auditors";
import {
  MODULE_LABELS,
  MODULE_WEIGHTS,
  type ModuleKey,
} from "@/lib/types/audit";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const KEYS = Object.keys(MODULE_WEIGHTS) as ModuleKey[];

function scoreColor(score: number) {
  return score >= 75 ? c.green : score >= 50 ? c.yellow : c.red;
}

async function main() {
  const url = process.argv[2] ?? "https://example.com";

  if (!process.env.GOOGLE_PAGESPEED_API_KEY) {
    console.log(
      `${c.yellow}⚠ Sin GOOGLE_PAGESPEED_API_KEY: Performance y Accesibilidad quedarán sin datos.${c.reset}`,
    );
  }

  console.log(`\n${c.bold}WebAudit · runner local${c.reset}`);
  console.log(`${c.dim}URL objetivo: ${url}${c.reset}`);
  console.log(`${c.dim}Corriendo módulos (en orden real de finalización)…${c.reset}\n`);

  const start = Date.now();

  const { scores, results } = await runAudit(url, (key, module) => {
    const t = ((Date.now() - start) / 1000).toFixed(1).padStart(5);
    const label = MODULE_LABELS[key].padEnd(14);
    if (module.error) {
      console.log(
        `${c.gray}[${t}s]${c.reset} ❌ ${label} ${c.red}${module.error}${c.reset}`,
      );
    } else {
      const col = scoreColor(module.score);
      console.log(
        `${c.gray}[${t}s]${c.reset} ✅ ${label} ${col}${c.bold}${String(
          module.score,
        ).padStart(3)}${c.reset} ${c.dim}(${module.checks.length} checks)${c.reset}`,
      );
    }
  });

  // --- Resumen de scores -----------------------------------------------------
  console.log(`\n${c.bold}── Scores ─────────────────────────────${c.reset}`);
  for (const k of KEYS) {
    const m = results[k];
    const col = scoreColor(m.score);
    console.log(
      `  ${MODULE_LABELS[k].padEnd(14)} ${col}${String(m.score).padStart(
        3,
      )}${c.reset} ${c.dim}× ${MODULE_WEIGHTS[k] * 100}%${c.reset}`,
    );
  }
  console.log(`  ${c.dim}${"─".repeat(20)}${c.reset}`);
  const oc = scoreColor(scores.overall);
  console.log(
    `  ${c.bold}GENERAL${c.reset}        ${oc}${c.bold}${String(
      scores.overall,
    ).padStart(3)}${c.reset}`,
  );
  console.log(
    `\n${c.dim}Duración total: ${((Date.now() - start) / 1000).toFixed(
      1,
    )}s · ${results.meta.finalUrl}${c.reset}`,
  );

  // --- Principales hallazgos (failed + warning) ------------------------------
  console.log(`\n${c.bold}Principales hallazgos:${c.reset}`);
  let any = false;
  for (const k of KEYS) {
    const issues = results[k].checks.filter(
      (ch) => ch.status === "failed" || ch.status === "warning",
    );
    if (issues.length === 0) continue;
    any = true;
    console.log(`\n  ${c.cyan}${MODULE_LABELS[k]}${c.reset}`);
    for (const ch of issues.slice(0, 4)) {
      const icon = ch.status === "failed" ? "❌" : "⚠️ ";
      console.log(`    ${icon} ${ch.label}: ${c.dim}${ch.message}${c.reset}`);
    }
  }
  if (!any) {
    console.log(`  ${c.green}Sin advertencias ni fallos. ¡Impecable!${c.reset}`);
  }
  console.log();
}

main().catch((e) => {
  console.error(`${c.red}Error fatal:${c.reset}`, e);
  process.exit(1);
});
