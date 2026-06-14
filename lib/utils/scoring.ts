import {
  AuditCheck,
  AuditScores,
  CheckStatus,
  ModuleKey,
  ModuleResult,
  MODULE_WEIGHTS,
} from "@/lib/types/audit";

/** Clampa un número a 0-100 y lo redondea. */
export function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Deriva un score 0-100 a partir de una lista de checks.
 * - passed  => 100% del peso
 * - warning => 50% del peso
 * - failed  => 0% del peso
 * - info    => no cuenta (peso 0)
 *
 * Permite pesos por check; por defecto todos pesan 1.
 */
export function scoreFromChecks(
  checks: AuditCheck[],
  weights: Record<string, number> = {},
): number {
  const contribution: Record<CheckStatus, number> = {
    passed: 1,
    warning: 0.5,
    failed: 0,
    info: 0,
  };

  let totalWeight = 0;
  let earned = 0;

  for (const check of checks) {
    if (check.status === "info") continue;
    const w = weights[check.id] ?? 1;
    totalWeight += w;
    earned += w * contribution[check.status];
  }

  if (totalWeight === 0) return 100;
  return clampScore((earned / totalWeight) * 100);
}

/** Calcula el score general como promedio ponderado de los módulos. */
export function computeOverall(
  moduleScores: Record<ModuleKey, number>,
): number {
  let sum = 0;
  for (const key of Object.keys(MODULE_WEIGHTS) as ModuleKey[]) {
    sum += moduleScores[key] * MODULE_WEIGHTS[key];
  }
  return clampScore(sum);
}

/** Arma el objeto AuditScores a partir de los 5 ModuleResult. */
export function buildScores(modules: ModuleResult[]): AuditScores {
  const byKey = Object.fromEntries(
    modules.map((m) => [m.key, m.score]),
  ) as Record<ModuleKey, number>;

  return {
    seo: byKey.seo,
    performance: byKey.performance,
    accessibility: byKey.accessibility,
    security: byKey.security,
    code: byKey.code,
    overall: computeOverall(byKey),
  };
}

/** Color semántico de un score para la UI. */
export function scoreColor(score: number): "bad" | "mid" | "good" {
  if (score < 50) return "bad";
  if (score < 75) return "mid";
  return "good";
}
