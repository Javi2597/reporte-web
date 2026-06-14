// ============================================================================
// Tipos centrales de WebAudit
// ============================================================================

export type ModuleKey =
  | "seo"
  | "performance"
  | "accessibility"
  | "security"
  | "code";

export type AuditStatus = "pending" | "running" | "completed" | "failed";

/** Severidad/estado de cada check individual dentro de un módulo. */
export type CheckStatus = "passed" | "warning" | "failed" | "info";

/** Impacto de un issue, usado para priorizar "quick wins". */
export type CheckImpact = "high" | "medium" | "low";

/** Un check atómico: una verificación concreta con su recomendación. */
export interface AuditCheck {
  /** id estable para el check, ej: "seo.meta-title" */
  id: string;
  /** Título legible, ej: "Meta title" */
  label: string;
  status: CheckStatus;
  /** Qué se encontró. Ej: "El title tiene 72 caracteres (ideal 50-60)." */
  message: string;
  /** Cómo arreglarlo. Solo se muestra cuando status != passed. */
  recommendation?: string;
  /** Valor crudo útil para la UI (texto encontrado, conteos, etc.). */
  value?: string | number | boolean | null;
  /** Impacto del issue (para priorizar quick wins). Default: medium. */
  impact?: CheckImpact;
  /** Ahorro estimado al corregirlo (Performance: ms / KB). */
  savingsMs?: number;
  savingsKb?: number;
}

/** Resultado de un módulo de auditoría. */
export interface ModuleResult {
  key: ModuleKey;
  /** Nombre legible del módulo. */
  label: string;
  /** 0-100. */
  score: number;
  checks: AuditCheck[];
  /** Si el módulo entero falló (timeout, red, etc.). */
  error?: string;
}

/** Pesos de cada módulo en el score general (deben sumar 1). */
export const MODULE_WEIGHTS: Record<ModuleKey, number> = {
  seo: 0.25,
  performance: 0.3,
  accessibility: 0.2,
  security: 0.15,
  code: 0.1,
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  seo: "SEO",
  performance: "Rendimiento",
  accessibility: "Accesibilidad",
  security: "Seguridad",
  code: "Código",
};

/** Scores resumidos que se guardan en la columna `scores` (jsonb). */
export interface AuditScores {
  seo: number;
  performance: number;
  accessibility: number;
  security: number;
  code: number;
  overall: number;
}

/** Resultado detallado completo que se guarda en `results` (jsonb). */
export interface AuditResults {
  seo: ModuleResult;
  performance: ModuleResult;
  accessibility: ModuleResult;
  security: ModuleResult;
  code: ModuleResult;
  /** Metadatos útiles para el reporte. */
  meta: {
    normalizedUrl: string;
    finalUrl: string;
    fetchedAt: string;
    durationMs: number;
  };
}

/** Estado en vivo de un módulo mientras corre la auditoría. */
export type ModuleProgressStatus = "pending" | "done" | "failed";

export interface ModuleProgress {
  status: ModuleProgressStatus;
  /** Score del módulo una vez terminado (0 si falló). */
  score: number;
}

/** Progreso por módulo; se va completando mientras la auditoría corre. */
export type AuditProgress = Partial<Record<ModuleKey, ModuleProgress>>;

/** Fila de la tabla `audits` en Supabase. */
export interface AuditRow {
  id: string;
  url: string;
  status: AuditStatus;
  scores: AuditScores | null;
  results: AuditResults | null;
  progress: AuditProgress | null;
  created_at: string;
  user_id: string | null;
}

// ----------------------------------------------------------------------------
// Contexto compartido que el orquestador pasa a cada auditor.
// Evita refetchear el HTML / PageSpeed varias veces.
// ----------------------------------------------------------------------------

export type PageSpeedStrategy = "mobile" | "desktop";

export interface FetchedPage {
  /** URL final tras redirecciones. */
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
}

export interface AuditContext {
  /** URL normalizada que se pidió auditar. */
  url: string;
  /** HTML de la página principal (null si no se pudo bajar). */
  page: FetchedPage | null;
  /** Respuesta cruda de PageSpeed por estrategia (null si falló o sin API key). */
  pagespeed: Partial<Record<PageSpeedStrategy, PageSpeedResult>>;
}

/** Cada auditor implementa esta firma. */
export type Auditor = (ctx: AuditContext) => Promise<ModuleResult>;

/** Callback que el orquestador invoca cuando un módulo termina. */
export type ProgressCallback = (
  key: ModuleKey,
  result: ModuleResult,
) => void | Promise<void>;

// ----------------------------------------------------------------------------
// Subconjunto tipado de la respuesta de PageSpeed Insights (Lighthouse v5)
// ----------------------------------------------------------------------------

export interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  numericValue?: number;
  /** Detalle; para opportunities trae overallSavingsMs/Bytes; para a11y, items. */
  details?: {
    type?: string;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
    items?: unknown[];
  };
}

export interface LighthouseCategory {
  id: string;
  title: string;
  score: number | null;
  auditRefs: { id: string; weight: number; group?: string }[];
}

/** Métrica de campo (CrUX): datos reales de usuarios, percentil 75. */
export interface CruxMetric {
  percentile: number;
  category: "FAST" | "AVERAGE" | "SLOW";
}

export interface LoadingExperience {
  overall_category?: "FAST" | "AVERAGE" | "SLOW";
  metrics?: Record<string, CruxMetric>;
}

export interface PageSpeedResult {
  strategy: PageSpeedStrategy;
  /** Datos de campo de la URL exacta (Chrome UX Report). Puede no existir. */
  loadingExperience?: LoadingExperience;
  /** Datos de campo a nivel origen (fallback cuando la URL no tiene suficientes datos). */
  originLoadingExperience?: LoadingExperience;
  lighthouseResult: {
    categories: Record<string, LighthouseCategory>;
    audits: Record<string, LighthouseAudit>;
  };
}
