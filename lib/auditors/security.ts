import * as cheerio from "cheerio";
import { AuditCheck, AuditContext, ModuleResult } from "@/lib/types/audit";
import { scoreFromChecks } from "@/lib/utils/scoring";

/**
 * Auditor de Seguridad. Analiza los headers HTTP de la respuesta, HTTPS y
 * mixed content. Usa la página ya descargada por el orquestador (incluye
 * headers y URL final tras redirecciones).
 */
export async function auditSecurity(ctx: AuditContext): Promise<ModuleResult> {
  const base: ModuleResult = {
    key: "security",
    label: "Seguridad",
    score: 0,
    checks: [],
  };

  if (!ctx.page) {
    return { ...base, error: "No se pudo descargar la página." };
  }

  const { finalUrl, headers, html } = ctx.page;
  const checks: AuditCheck[] = [];
  const isHttps = finalUrl.startsWith("https://");

  // --- HTTPS -----------------------------------------------------------------
  checks.push({
    id: "security.https",
    label: "HTTPS",
    status: isHttps ? "passed" : "failed",
    message: isHttps
      ? "El sitio se sirve sobre HTTPS."
      : "El sitio NO usa HTTPS.",
    recommendation: isHttps
      ? undefined
      : "Instalá un certificado SSL y forzá HTTPS con redirección 301 desde HTTP.",
    value: isHttps,
  });

  // Si carga por https sin error, el certificado es válido (fetch falla con
  // certificados inválidos). Lo reportamos como check informativo/derivado.
  checks.push({
    id: "security.ssl-cert",
    label: "Certificado SSL válido",
    status: isHttps ? "passed" : "failed",
    message: isHttps
      ? "La conexión TLS se estableció correctamente (certificado válido y vigente)."
      : "No hay conexión segura para validar el certificado.",
    recommendation: isHttps
      ? undefined
      : "Configurá un certificado SSL válido (ej. Let's Encrypt) en tu hosting.",
    value: isHttps,
  });

  // --- Security headers ------------------------------------------------------
  const headerChecks: {
    id: string;
    header: string;
    label: string;
    weight: number;
    rec: string;
  }[] = [
    {
      id: "security.hsts",
      header: "strict-transport-security",
      label: "Strict-Transport-Security",
      weight: 1.5,
      rec: 'Agregá "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload".',
    },
    {
      id: "security.x-frame-options",
      header: "x-frame-options",
      label: "X-Frame-Options",
      weight: 1,
      rec: 'Agregá "X-Frame-Options: SAMEORIGIN" para mitigar clickjacking (o usá CSP frame-ancestors).',
    },
    {
      id: "security.x-content-type-options",
      header: "x-content-type-options",
      label: "X-Content-Type-Options",
      weight: 1,
      rec: 'Agregá "X-Content-Type-Options: nosniff".',
    },
    {
      id: "security.csp",
      header: "content-security-policy",
      label: "Content-Security-Policy",
      weight: 1.5,
      rec: "Definí una Content-Security-Policy para mitigar XSS e inyección de recursos.",
    },
    {
      id: "security.referrer-policy",
      header: "referrer-policy",
      label: "Referrer-Policy",
      weight: 0.5,
      rec: 'Agregá "Referrer-Policy: strict-origin-when-cross-origin".',
    },
    {
      id: "security.permissions-policy",
      header: "permissions-policy",
      label: "Permissions-Policy",
      weight: 0.5,
      rec: "Definí una Permissions-Policy para limitar APIs del navegador (cámara, micrófono, geolocalización, etc.).",
    },
  ];

  const weights: Record<string, number> = {
    "security.https": 3,
    "security.ssl-cert": 1,
    "security.mixed-content": 2,
  };

  for (const h of headerChecks) {
    const present = headers[h.header] !== undefined;
    checks.push({
      id: h.id,
      label: h.label,
      status: present ? "passed" : "warning",
      message: present
        ? `Presente: ${truncate(headers[h.header])}`
        : `Falta el header ${h.label}.`,
      recommendation: present ? undefined : h.rec,
      value: present ? headers[h.header] : null,
    });
    weights[h.id] = h.weight;
  }

  // --- Mixed content ---------------------------------------------------------
  if (isHttps) {
    const $ = cheerio.load(html);
    const insecure: string[] = [];
    $("img[src], script[src], link[href], iframe[src], source[src]").each(
      (_, el) => {
        const $el = $(el);
        const attr = $el.attr("src") ?? $el.attr("href") ?? "";
        if (attr.startsWith("http://")) insecure.push(attr);
      },
    );
    const count = insecure.length;
    checks.push({
      id: "security.mixed-content",
      label: "Mixed content",
      status: count === 0 ? "passed" : "failed",
      message:
        count === 0
          ? "No se detectó contenido mixto (todos los recursos por HTTPS)."
          : `${count} recurso(s) cargados por HTTP en una página HTTPS.`,
      recommendation:
        count === 0
          ? undefined
          : `Cambiá a https:// estos recursos: ${insecure
              .slice(0, 3)
              .join(", ")}${count > 3 ? "…" : ""}`,
      value: count,
    });
  } else {
    checks.push({
      id: "security.mixed-content",
      label: "Mixed content",
      status: "info",
      message: "No aplica (el sitio no usa HTTPS).",
      value: null,
    });
  }

  base.checks = checks;
  base.score = scoreFromChecks(checks, weights);
  return base;
}

function truncate(s: string, n = 80): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
