import {
  AuditResults,
  AuditScores,
  FetchedPage,
  ModuleKey,
  ModuleResult,
  MODULE_LABELS,
  PageSpeedResult,
  PageSpeedStrategy,
  ProgressCallback,
} from "@/lib/types/audit";
import { normalizeUrl } from "@/lib/utils/url";
import { buildScores } from "@/lib/utils/scoring";
import { auditSeo } from "./seo";
import { auditPerformance, fetchPageSpeed } from "./performance";
import { auditAccessibility } from "./accessibility";
import { auditSecurity } from "./security";
import { auditCode } from "./code";

const TOTAL_TIMEOUT_MS = 30_000;
const PAGE_FETCH_TIMEOUT_MS = 15_000;

const ALL_KEYS: ModuleKey[] = [
  "seo",
  "performance",
  "accessibility",
  "security",
  "code",
];

export interface RunAuditOutput {
  scores: AuditScores;
  results: AuditResults;
}

/**
 * Orquesta una auditoría completa para una URL.
 *
 * Cada módulo corre en cuanto su dependencia está lista, no todos a la vez:
 * - SEO / Seguridad / Código dependen solo del HTML (rápido).
 * - Performance / Accesibilidad dependen de PageSpeed (más lento).
 * Por eso el progreso real es escalonado.
 *
 * `onProgress` se invoca apenas cada módulo termina (éxito o fallo), lo que
 * permite reflejar el avance real en la UI.
 */
export async function runAudit(
  rawUrl: string,
  onProgress?: ProgressCallback,
): Promise<RunAuditOutput> {
  const start = Date.now();
  const url = normalizeUrl(rawUrl);

  const globalController = new AbortController();
  const globalTimeout = setTimeout(
    () => globalController.abort(),
    TOTAL_TIMEOUT_MS,
  );

  try {
    // Promesas compartidas (se disparan una vez, las consumen varios módulos).
    const pagePromise = fetchPage(url);
    const pagespeedPromise = Promise.all([
      fetchPageSpeed(url, "mobile", globalController.signal),
      fetchPageSpeed(url, "desktop", globalController.signal),
    ]).then(([mobile, desktop]) => {
      const ps: Partial<Record<PageSpeedStrategy, PageSpeedResult>> = {};
      if (mobile) ps.mobile = mobile;
      if (desktop) ps.desktop = desktop;
      return ps;
    });

    // Cada runner espera solo lo que necesita.
    const runners: Record<ModuleKey, () => Promise<ModuleResult>> = {
      seo: async () =>
        auditSeo({ url, page: await pagePromise, pagespeed: {} }),
      security: async () =>
        auditSecurity({ url, page: await pagePromise, pagespeed: {} }),
      code: async () =>
        auditCode({ url, page: await pagePromise, pagespeed: {} }),
      performance: async () =>
        auditPerformance({
          url,
          page: null,
          pagespeed: await pagespeedPromise,
        }),
      accessibility: async () =>
        auditAccessibility({
          url,
          page: null,
          pagespeed: await pagespeedPromise,
        }),
    };

    // Correr los 5 en paralelo; cada uno reporta su progreso al terminar.
    const settled = await Promise.all(
      ALL_KEYS.map(async (key) => {
        let result: ModuleResult;
        try {
          result = await runners[key]();
        } catch (e) {
          result = failedModule(key, e);
        }
        if (onProgress) {
          try {
            await onProgress(key, result);
          } catch (err) {
            console.error(`[runAudit] onProgress(${key}) error:`, err);
          }
        }
        return result;
      }),
    );

    const byKey = Object.fromEntries(
      settled.map((m) => [m.key, m]),
    ) as Record<ModuleKey, ModuleResult>;

    const page = await pagePromise;
    const scores = buildScores(settled);
    const results: AuditResults = {
      seo: byKey.seo,
      performance: byKey.performance,
      accessibility: byKey.accessibility,
      security: byKey.security,
      code: byKey.code,
      meta: {
        normalizedUrl: url,
        finalUrl: page?.finalUrl ?? url,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      },
    };

    return { scores, results };
  } finally {
    clearTimeout(globalTimeout);
  }
}

/** Baja el HTML de la URL siguiendo redirecciones. Devuelve null si falla. */
async function fetchPage(url: string): Promise<FetchedPage | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WebAuditBot/0.1; +https://webaudit.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return { finalUrl: res.url || url, status: res.status, headers, html };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Construye un ModuleResult de error cuando un auditor lanzó excepción. */
function failedModule(key: ModuleKey, reason: unknown): ModuleResult {
  const message =
    reason instanceof Error ? reason.message : "Error desconocido.";
  return {
    key,
    label: MODULE_LABELS[key],
    score: 0,
    checks: [],
    error: `El módulo falló: ${message}`,
  };
}
