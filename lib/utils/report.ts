import {
  AuditCheck,
  AuditResults,
  AuditScores,
  CheckImpact,
  CheckStatus,
  ModuleKey,
  MODULE_LABELS,
  MODULE_WEIGHTS,
} from "@/lib/types/audit";

const MODULE_ORDER: ModuleKey[] = [
  "seo",
  "performance",
  "accessibility",
  "security",
  "code",
];

// ----------------------------------------------------------------------------
// #5 · Resumen de estadísticas
// ----------------------------------------------------------------------------

export interface AuditSummary {
  total: number;
  passed: number;
  warning: number;
  failed: number;
  info: number;
}

/** Cuenta los checks por estado a lo largo de los 5 módulos. */
export function summarizeChecks(results: AuditResults): AuditSummary {
  const summary: AuditSummary = {
    total: 0,
    passed: 0,
    warning: 0,
    failed: 0,
    info: 0,
  };
  for (const key of MODULE_ORDER) {
    for (const c of results[key].checks) {
      summary.total++;
      summary[c.status]++;
    }
  }
  return summary;
}

// ----------------------------------------------------------------------------
// #5 · Quick wins (priorizados por impacto × peso del módulo × severidad)
// ----------------------------------------------------------------------------

export interface QuickWin {
  module: ModuleKey;
  moduleLabel: string;
  check: AuditCheck;
  priority: number;
}

const IMPACT_WEIGHT: Record<CheckImpact, number> = {
  high: 3,
  medium: 2,
  low: 1,
};
const STATUS_WEIGHT: Partial<Record<CheckStatus, number>> = {
  failed: 2,
  warning: 1,
};

/**
 * Junta los issues accionables (failed/warning con recomendación) de todos los
 * módulos y los prioriza: alto impacto + módulo de mayor peso + más severo
 * primero. Devuelve los primeros `limit`.
 */
export function collectQuickWins(
  results: AuditResults,
  limit = 6,
): QuickWin[] {
  const wins: QuickWin[] = [];

  for (const module of MODULE_ORDER) {
    for (const check of results[module].checks) {
      if (check.status !== "failed" && check.status !== "warning") continue;
      if (!check.recommendation) continue;

      const impact = IMPACT_WEIGHT[check.impact ?? "medium"];
      const severity = STATUS_WEIGHT[check.status] ?? 1;
      // Bonus por ahorro de tiempo (oportunidades de performance).
      const savingsBonus = check.savingsMs ? Math.min(check.savingsMs / 1000, 3) : 0;
      const priority =
        impact * severity * (0.5 + MODULE_WEIGHTS[module]) + savingsBonus;

      wins.push({
        module,
        moduleLabel: MODULE_LABELS[module],
        check,
        priority,
      });
    }
  }

  return wins.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

// ----------------------------------------------------------------------------
// #4 · Deltas vs auditoría anterior
// ----------------------------------------------------------------------------

export type ScoreDeltas = Partial<Record<keyof AuditScores, number>>;

/**
 * Calcula la diferencia de cada score contra una auditoría previa.
 * Devuelve null si no hay scores previos.
 */
export function computeDeltas(
  current: AuditScores,
  previous: AuditScores | null | undefined,
): ScoreDeltas | null {
  if (!previous) return null;
  const keys = Object.keys(current) as (keyof AuditScores)[];
  const deltas: ScoreDeltas = {};
  for (const k of keys) {
    deltas[k] = current[k] - previous[k];
  }
  return deltas;
}
