import {
  AuditCheck,
  AuditContext,
  CruxMetric,
  LighthouseAudit,
  LoadingExperience,
  ModuleResult,
  PageSpeedResult,
  PageSpeedStrategy,
} from "@/lib/types/audit";
import { clampScore } from "@/lib/utils/scoring";

/**
 * Auditor de Performance basado en Google PageSpeed Insights (Lighthouse).
 * El orquestador ya hizo el fetch (mobile + desktop) y lo dejó en ctx.pagespeed.
 *
 * El score del módulo es el Performance score de Lighthouse (mobile prioriza,
 * por ser el peor caso y lo que Google usa para ranking).
 *
 * Además de los datos de laboratorio, surfacea:
 *  - Datos de CAMPO (CrUX): Core Web Vitals reales de usuarios (p75).
 *  - Oportunidades: mejoras con ahorro estimado en ms/KB.
 */
export async function auditPerformance(
  ctx: AuditContext,
): Promise<ModuleResult> {
  const base: ModuleResult = {
    key: "performance",
    label: "Rendimiento",
    score: 0,
    checks: [],
  };

  const mobile = ctx.pagespeed.mobile;
  const desktop = ctx.pagespeed.desktop;
  const primary = mobile ?? desktop;

  if (!primary) {
    return {
      ...base,
      error:
        "No se pudo obtener datos de PageSpeed Insights (¿falta GOOGLE_PAGESPEED_API_KEY o la URL no es accesible públicamente?).",
    };
  }

  const checks: AuditCheck[] = [];

  // --- Scores de categorías Lighthouse --------------------------------------
  const cat = (r: PageSpeedResult, id: string) =>
    Math.round((r.lighthouseResult.categories[id]?.score ?? 0) * 100);

  const perfMobile = mobile ? cat(mobile, "performance") : null;
  const perfDesktop = desktop ? cat(desktop, "performance") : null;

  pushCategory(checks, "performance.score", "Rendimiento (Lighthouse)", {
    mobile: perfMobile,
    desktop: perfDesktop,
  });
  pushCategory(checks, "performance.accessibility", "Accesibilidad (Lighthouse)", {
    mobile: mobile ? cat(mobile, "accessibility") : null,
    desktop: desktop ? cat(desktop, "accessibility") : null,
  });
  pushCategory(checks, "performance.seo", "SEO (Lighthouse)", {
    mobile: mobile ? cat(mobile, "seo") : null,
    desktop: desktop ? cat(desktop, "seo") : null,
  });
  pushCategory(
    checks,
    "performance.best-practices",
    "Buenas prácticas (Lighthouse)",
    {
      mobile: mobile ? cat(mobile, "best-practices") : null,
      desktop: desktop ? cat(desktop, "best-practices") : null,
    },
  );

  // --- Datos de CAMPO (CrUX): usuarios reales, percentil 75 ------------------
  // Preferimos los datos de la URL exacta; si no hay, los del origen.
  const field = primary.loadingExperience?.metrics
    ? primary.loadingExperience
    : primary.originLoadingExperience;
  const fieldScope =
    field === primary.loadingExperience ? "esta URL" : "el sitio (origen)";

  if (field?.metrics && Object.keys(field.metrics).length > 0) {
    pushCrux(checks, field.metrics, "LARGEST_CONTENTFUL_PAINT_MS", "LCP (real)", fieldScope, "ms");
    pushCrux(checks, field.metrics, "INTERACTION_TO_NEXT_PAINT", "INP (real)", fieldScope, "ms");
    pushCrux(checks, field.metrics, "CUMULATIVE_LAYOUT_SHIFT_SCORE", "CLS (real)", fieldScope, "cls");
    pushCrux(checks, field.metrics, "FIRST_CONTENTFUL_PAINT_MS", "FCP (real)", fieldScope, "ms");
    pushCrux(
      checks,
      field.metrics,
      "EXPERIMENTAL_TIME_TO_FIRST_BYTE",
      "TTFB (real)",
      fieldScope,
      "ms",
    );
  } else {
    checks.push({
      id: "performance.crux.none",
      label: "Datos de usuarios reales (CrUX)",
      status: "info",
      message:
        "Sin datos de campo: el sitio no tiene tráfico suficiente en el Chrome UX Report. Se usan solo datos de laboratorio.",
      value: null,
    });
  }

  // --- Core Web Vitals de LABORATORIO ---------------------------------------
  // Umbrales "good" de Google.
  pushMetric(checks, primary, "largest-contentful-paint", "LCP (laboratorio)", {
    good: 2500,
    poor: 4000,
    unit: "ms",
  });
  pushMetric(checks, primary, "cumulative-layout-shift", "CLS (laboratorio)", {
    good: 0.1,
    poor: 0.25,
    unit: "",
  });
  pushMetric(checks, primary, "total-blocking-time", "TBT (aprox. de INP)", {
    good: 200,
    poor: 600,
    unit: "ms",
  });
  pushMetric(checks, primary, "first-contentful-paint", "FCP (laboratorio)", {
    good: 1800,
    poor: 3000,
    unit: "ms",
  });
  pushMetric(checks, primary, "server-response-time", "TTFB (laboratorio)", {
    good: 800,
    poor: 1800,
    unit: "ms",
  });

  // --- Oportunidades de mejora con ahorro estimado --------------------------
  const opportunities = collectOpportunities(primary);
  if (opportunities.length === 0) {
    checks.push({
      id: "performance.opportunities.none",
      label: "Oportunidades de mejora",
      status: "passed",
      message: "Sin oportunidades relevantes detectadas por Lighthouse.",
      value: 0,
    });
  } else {
    for (const op of opportunities) checks.push(op);
  }

  base.checks = checks;

  // El score del módulo: si tenemos mobile y desktop, promediamos su perf score
  // dando más peso a mobile (60/40). Si solo hay uno, usamos ese.
  let moduleScore: number;
  if (perfMobile !== null && perfDesktop !== null) {
    moduleScore = clampScore(perfMobile * 0.6 + perfDesktop * 0.4);
  } else {
    moduleScore = clampScore(perfMobile ?? perfDesktop ?? 0);
  }
  base.score = moduleScore;
  return base;
}

function statusFromScore(score: number | null): AuditCheck["status"] {
  if (score === null) return "info";
  if (score >= 90) return "passed";
  if (score >= 50) return "warning";
  return "failed";
}

function pushCategory(
  checks: AuditCheck[],
  id: string,
  label: string,
  scores: { mobile: number | null; desktop: number | null },
) {
  const ref = scores.mobile ?? scores.desktop;
  const parts: string[] = [];
  if (scores.mobile !== null) parts.push(`mobile ${scores.mobile}`);
  if (scores.desktop !== null) parts.push(`desktop ${scores.desktop}`);
  const status = statusFromScore(ref);
  checks.push({
    id,
    label,
    status,
    message: parts.length ? parts.join(" · ") : "Sin datos.",
    recommendation:
      status === "passed"
        ? undefined
        : "Revisá las oportunidades de mejora en el reporte de PageSpeed Insights para esta categoría.",
    value: ref,
    impact: id === "performance.score" ? "high" : "medium",
  });
}

/** Umbrales de Google para las métricas de campo (CrUX). */
const CRUX_THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LARGEST_CONTENTFUL_PAINT_MS: { good: 2500, poor: 4000 },
  INTERACTION_TO_NEXT_PAINT: { good: 200, poor: 500 },
  CUMULATIVE_LAYOUT_SHIFT_SCORE: { good: 10, poor: 25 }, // viene ×100
  FIRST_CONTENTFUL_PAINT_MS: { good: 1800, poor: 3000 },
  EXPERIMENTAL_TIME_TO_FIRST_BYTE: { good: 800, poor: 1800 },
};

function pushCrux(
  checks: AuditCheck[],
  metrics: Record<string, CruxMetric>,
  key: string,
  label: string,
  scope: string,
  unit: "ms" | "cls",
) {
  const m = metrics[key];
  if (!m) return;
  const th = CRUX_THRESHOLDS[key];
  const status: AuditCheck["status"] =
    m.category === "FAST" ? "passed" : m.category === "AVERAGE" ? "warning" : "failed";
  const display =
    unit === "cls"
      ? (m.percentile / 100).toFixed(2)
      : `${Math.round(m.percentile)} ms`;
  checks.push({
    id: `performance.crux.${key}`,
    label,
    status,
    message: `${label}: ${display} en ${scope} — p75 de usuarios reales (${m.category}).`,
    recommendation:
      status === "passed"
        ? undefined
        : `Mejorá ${label.replace(" (real)", "")}: usuarios reales superan el umbral${
            th ? ` recomendado (${th.good}${unit === "cls" ? "" : "ms"})` : ""
          }.`,
    value: display,
    impact: "high",
  });
}

function pushMetric(
  checks: AuditCheck[],
  result: PageSpeedResult,
  auditId: string,
  label: string,
  cfg: { good: number; poor: number; unit: string },
) {
  const audit = result.lighthouseResult.audits[auditId];
  if (!audit || audit.numericValue === undefined) {
    checks.push({
      id: `performance.cwv.${auditId}`,
      label,
      status: "info",
      message: "Métrica no disponible en este análisis.",
      value: null,
    });
    return;
  }
  const v = audit.numericValue;
  const status: AuditCheck["status"] =
    v <= cfg.good ? "passed" : v <= cfg.poor ? "warning" : "failed";
  const display =
    audit.displayValue ??
    (cfg.unit === "ms" ? `${Math.round(v)} ms` : v.toFixed(3));
  checks.push({
    id: `performance.cwv.${auditId}`,
    label,
    status,
    message: `${label}: ${display} (${result.strategy}).`,
    recommendation:
      status === "passed"
        ? undefined
        : `Mejorá ${label}: el valor supera el umbral recomendado de Google.`,
    value: display,
    impact: "medium",
  });
}

/**
 * Extrae las oportunidades de Lighthouse (audits con ahorro estimado),
 * ordenadas por mayor ahorro de tiempo. Devuelve hasta 6.
 */
function collectOpportunities(result: PageSpeedResult): AuditCheck[] {
  const audits = result.lighthouseResult.audits;
  const ops: {
    audit: LighthouseAudit;
    ms: number;
    bytes: number;
  }[] = [];

  for (const audit of Object.values(audits)) {
    const ms = audit.details?.overallSavingsMs ?? 0;
    const bytes = audit.details?.overallSavingsBytes ?? 0;
    // Es oportunidad si no pasa (score < 0.9) y promete algún ahorro real.
    const failing = audit.score !== null && audit.score < 0.9;
    if (failing && (ms >= 100 || bytes >= 20_000)) {
      ops.push({ audit, ms, bytes });
    }
  }

  ops.sort((a, b) => b.ms - a.ms || b.bytes - a.bytes);

  return ops.slice(0, 6).map(({ audit, ms, bytes }) => {
    const kb = Math.round(bytes / 1024);
    const savingParts: string[] = [];
    if (ms >= 100) savingParts.push(`~${(ms / 1000).toFixed(1)}s`);
    if (kb >= 20) savingParts.push(`~${kb} KB`);
    const saving = savingParts.join(" · ");
    const status: AuditCheck["status"] = ms >= 1000 ? "failed" : "warning";
    return {
      id: `performance.opportunity.${audit.id}`,
      label: audit.title,
      status,
      message: `Ahorro estimado: ${saving} (${result.strategy}).`,
      recommendation: stripHtml(audit.description) || audit.title,
      value: saving,
      impact: ms >= 1000 ? "high" : "medium",
      savingsMs: ms || undefined,
      savingsKb: kb || undefined,
    };
  });
}

/** Limpia markdown/links de las descripciones de Lighthouse. */
function stripHtml(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [texto](url) -> texto
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/**
 * Llama a la PageSpeed Insights API para una estrategia. Devuelve null si
 * no hay API key, hay error de red o la API responde con error.
 * Exportada para que el orquestador la invoque una vez por estrategia.
 */
export async function fetchPageSpeed(
  url: string,
  strategy: PageSpeedStrategy,
  signal?: AbortSignal,
): Promise<PageSpeedResult | null> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  // locale=es → Lighthouse devuelve títulos y descripciones en español.
  endpoint.searchParams.set("locale", "es");
  for (const c of ["performance", "accessibility", "seo", "best-practices"]) {
    endpoint.searchParams.append("category", c);
  }
  if (apiKey) endpoint.searchParams.set("key", apiKey);

  try {
    const res = await fetch(endpoint.toString(), { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as Omit<PageSpeedResult, "strategy">;
    return { ...data, strategy };
  } catch {
    return null;
  }
}
