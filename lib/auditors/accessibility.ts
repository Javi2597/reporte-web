import {
  AuditCheck,
  AuditContext,
  CheckImpact,
  LighthouseAudit,
  ModuleResult,
  PageSpeedResult,
} from "@/lib/types/audit";

/**
 * Auditor de Accesibilidad.
 *
 * Nota de diseño: el reporte de accesibilidad de Lighthouse (que devuelve
 * PageSpeed Insights) está construido sobre axe-core. Reutilizamos esos audits
 * en lugar de correr puppeteer + axe-core en el server, porque puppeteer no es
 * viable en el runtime serverless de Vercel sin Chromium empaquetado.
 *
 * Severidad real: cada regla de Lighthouse tiene un `weight` en la categoría
 * (proxy del impacto de axe). Lo usamos para clasificar high/medium/low y para
 * ordenar las violaciones. También contamos cuántos ELEMENTOS afecta cada
 * regla (details.items), no solo si pasa o falla.
 */
export async function auditAccessibility(
  ctx: AuditContext,
): Promise<ModuleResult> {
  const base: ModuleResult = {
    key: "accessibility",
    label: "Accesibilidad",
    score: 0,
    checks: [],
  };

  const result = ctx.pagespeed.mobile ?? ctx.pagespeed.desktop;
  if (!result) {
    return {
      ...base,
      error:
        "No se pudo obtener el análisis de accesibilidad (PageSpeed/Lighthouse no disponible).",
    };
  }

  const checks: AuditCheck[] = [];
  const a11y = result.lighthouseResult.categories["accessibility"];
  const lighthouseScore = Math.round((a11y?.score ?? 0) * 100);
  const audits = result.lighthouseResult.audits;

  // Mapa id -> weight desde la categoría (el weight es el proxy de severidad).
  const weightById = new Map<string, number>();
  for (const ref of a11y?.auditRefs ?? []) {
    weightById.set(ref.id, ref.weight);
  }

  // Recolectar violaciones reales (audits binarios con score === 0).
  const violations: {
    audit: LighthouseAudit;
    weight: number;
    nodes: number;
    impact: CheckImpact;
  }[] = [];

  for (const ref of a11y?.auditRefs ?? []) {
    const audit = audits[ref.id];
    if (!audit || audit.score !== 0 || audit.scoreDisplayMode === "notApplicable")
      continue;
    const nodes = audit.details?.items?.length ?? 0;
    violations.push({
      audit,
      weight: ref.weight,
      nodes,
      impact: impactFromWeight(ref.weight),
    });
  }

  // Conteo por severidad para el resumen.
  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const v of violations) bySeverity[v.impact]++;

  // --- Check resumen con score + desglose por severidad ---------------------
  checks.push({
    id: "accessibility.summary",
    label: "Resumen de accesibilidad",
    status:
      lighthouseScore >= 90
        ? "passed"
        : lighthouseScore >= 50
          ? "warning"
          : "failed",
    message:
      violations.length === 0
        ? `Score ${lighthouseScore}/100. Sin violaciones de axe detectadas.`
        : `Score ${lighthouseScore}/100. ${violations.length} regla(s) fallando: ${bySeverity.high} alta · ${bySeverity.medium} media · ${bySeverity.low} baja.`,
    recommendation:
      lighthouseScore >= 90
        ? undefined
        : "Priorizá las violaciones de severidad alta (contraste, nombres accesibles, labels de formularios).",
    value: lighthouseScore,
    impact: "high",
  });

  // --- Grupos temáticos (siempre se muestran, con conteo de elementos) ------
  const groups: { id: string; label: string; auditIds: string[] }[] = [
    { id: "contrast", label: "Contraste de color", auditIds: ["color-contrast"] },
    {
      id: "aria",
      label: "ARIA y nombres accesibles",
      auditIds: [
        "aria-allowed-attr",
        "aria-required-attr",
        "aria-required-children",
        "aria-required-parent",
        "aria-roles",
        "aria-valid-attr",
        "aria-valid-attr-value",
        "button-name",
        "link-name",
        "image-alt",
      ],
    },
    {
      id: "forms",
      label: "Etiquetas de formularios",
      auditIds: ["label", "form-field-multiple-labels", "select-name"],
    },
    {
      id: "keyboard",
      label: "Navegación por teclado",
      auditIds: ["tabindex", "focusable-controls", "interactive-element-affordance"],
    },
  ];

  for (const g of groups) {
    const failing = g.auditIds
      .map((id) => audits[id])
      .filter((a): a is LighthouseAudit => !!a && a.score === 0);
    const nodes = failing.reduce(
      (sum, a) => sum + (a.details?.items?.length ?? 0),
      0,
    );
    const maxWeight = Math.max(
      0,
      ...failing.map((a) => weightById.get(a.id) ?? 0),
    );
    checks.push({
      id: `accessibility.${g.id}`,
      label: g.label,
      status: failing.length === 0 ? "passed" : "failed",
      message:
        failing.length === 0
          ? `Sin problemas (${g.label.toLowerCase()}).`
          : `${failing.length} regla(s) fallando${nodes ? `, ${nodes} elemento(s) afectado(s)` : ""}: ${failing
              .map((a) => a.title)
              .join("; ")}.`,
      recommendation:
        failing.length === 0
          ? undefined
          : stripHtml(failing[0]?.description ?? "") ||
            "Revisá las reglas de accesibilidad fallidas.",
      value: failing.length,
      impact: failing.length === 0 ? "low" : impactFromWeight(maxWeight),
    });
  }

  // --- Top violaciones por severidad (detalle accionable) -------------------
  const topViolations = [...violations]
    .sort((a, b) => b.weight - a.weight || b.nodes - a.nodes)
    .slice(0, 8);

  for (const v of topViolations) {
    checks.push({
      id: `accessibility.violation.${v.audit.id}`,
      label: v.audit.title,
      status: "failed",
      message: `${v.nodes || "?"} elemento(s) afectado(s) · severidad ${impactLabel(v.impact)}.`,
      recommendation: stripHtml(v.audit.description),
      value: v.nodes,
      impact: v.impact,
    });
  }

  base.checks = checks;
  // El score de Lighthouse ya es un promedio ponderado por impacto de las
  // reglas de axe, así que lo usamos tal cual (es lo que ve la gente en PSI).
  base.score = lighthouseScore;
  return base;
}

/** Lighthouse pondera las reglas de a11y; el peso es el proxy de severidad. */
function impactFromWeight(weight: number): CheckImpact {
  if (weight >= 7) return "high";
  if (weight >= 3) return "medium";
  return "low";
}

function impactLabel(impact: CheckImpact): string {
  return impact === "high" ? "alta" : impact === "medium" ? "media" : "baja";
}

function stripHtml(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .split(/\.\s/)[0]
    .trim();
}
