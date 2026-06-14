import * as cheerio from "cheerio";
import { AuditCheck, AuditContext, ModuleResult } from "@/lib/types/audit";
import { getOrigin } from "@/lib/utils/url";
import { scoreFromChecks } from "@/lib/utils/scoring";

/**
 * Auditor SEO. Analiza el HTML con cheerio + chequea sitemap/robots.txt.
 */
export async function auditSeo(ctx: AuditContext): Promise<ModuleResult> {
  const base: ModuleResult = {
    key: "seo",
    label: "SEO",
    score: 0,
    checks: [],
  };

  if (!ctx.page) {
    return {
      ...base,
      error: "No se pudo descargar el HTML de la página.",
    };
  }

  const $ = cheerio.load(ctx.page.html);
  const checks: AuditCheck[] = [];

  // --- Meta title -----------------------------------------------------------
  const title = $("head > title").first().text().trim();
  if (!title) {
    checks.push({
      id: "seo.meta-title",
      label: "Meta title",
      status: "failed",
      message: "La página no tiene <title>.",
      recommendation:
        "Agregá un <title> descriptivo y único de 50-60 caracteres dentro de <head>.",
      value: null,
    });
  } else {
    const len = title.length;
    const ok = len >= 50 && len <= 60;
    checks.push({
      id: "seo.meta-title",
      label: "Meta title",
      status: ok ? "passed" : "warning",
      message: ok
        ? `Title presente (${len} caracteres).`
        : `El title tiene ${len} caracteres (ideal 50-60).`,
      recommendation: ok
        ? undefined
        : "Ajustá el largo del title a 50-60 caracteres para evitar truncado en buscadores.",
      value: title,
    });
  }

  // --- Meta description ------------------------------------------------------
  const desc = ($('meta[name="description"]').attr("content") ?? "").trim();
  if (!desc) {
    checks.push({
      id: "seo.meta-description",
      label: "Meta description",
      status: "failed",
      message: "No hay meta description.",
      recommendation:
        'Agregá <meta name="description" content="..."> de 150-160 caracteres.',
      value: null,
    });
  } else {
    const len = desc.length;
    const ok = len >= 150 && len <= 160;
    checks.push({
      id: "seo.meta-description",
      label: "Meta description",
      status: ok ? "passed" : "warning",
      message: ok
        ? `Description presente (${len} caracteres).`
        : `La description tiene ${len} caracteres (ideal 150-160).`,
      recommendation: ok
        ? undefined
        : "Ajustá la description a 150-160 caracteres con un resumen atractivo de la página.",
      value: desc,
    });
  }

  // --- Meta robots (indexable) ----------------------------------------------
  const robots = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
  const noindex = robots.includes("noindex");
  checks.push({
    id: "seo.meta-robots",
    label: "Indexable",
    status: noindex ? "failed" : "passed",
    message: noindex
      ? 'La página tiene "noindex": los buscadores no la indexarán.'
      : robots
        ? `Meta robots: "${robots}".`
        : "Sin meta robots restrictivo: la página es indexable.",
    recommendation: noindex
      ? 'Quitá "noindex" de la meta robots si querés que esta página aparezca en buscadores.'
      : undefined,
    value: robots || "(none)",
  });

  // --- Open Graph ------------------------------------------------------------
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogMissing = [
    !ogTitle && "og:title",
    !ogDesc && "og:description",
    !ogImage && "og:image",
  ].filter(Boolean) as string[];
  checks.push({
    id: "seo.open-graph",
    label: "Open Graph",
    status: ogMissing.length === 0 ? "passed" : "warning",
    message:
      ogMissing.length === 0
        ? "Tags Open Graph principales presentes."
        : `Faltan tags Open Graph: ${ogMissing.join(", ")}.`,
    recommendation:
      ogMissing.length === 0
        ? undefined
        : "Agregá og:title, og:description y og:image para mejorar cómo se ve la página al compartirla en redes.",
    value: ogMissing.length === 0 ? "ok" : ogMissing.join(", "),
  });

  // --- Headings (H1 único + jerarquía) --------------------------------------
  const h1s = $("h1");
  const h1Count = h1s.length;
  let headingStatus: AuditCheck["status"] = "passed";
  let headingMsg = "Estructura de headings correcta (H1 único).";
  let headingRec: string | undefined;
  if (h1Count === 0) {
    headingStatus = "failed";
    headingMsg = "No hay ningún <h1> en la página.";
    headingRec = "Agregá un único <h1> que describa el contenido principal.";
  } else if (h1Count > 1) {
    headingStatus = "warning";
    headingMsg = `Hay ${h1Count} <h1> (debería haber solo uno).`;
    headingRec = "Dejá un único <h1> por página y usá <h2>-<h6> para el resto.";
  }

  // Chequeo simple de saltos de jerarquía (ej: h2 -> h4).
  const levels: number[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = ($(el).prop("tagName") ?? "").toLowerCase();
    levels.push(Number(tag.replace("h", "")));
  });
  let skipped = false;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      skipped = true;
      break;
    }
  }
  if (skipped && headingStatus === "passed") {
    headingStatus = "warning";
    headingMsg = "Hay saltos en la jerarquía de headings (ej: H2 → H4).";
    headingRec = "No te saltees niveles de heading; seguí el orden H1 → H2 → H3.";
  }
  checks.push({
    id: "seo.headings",
    label: "Estructura de headings",
    status: headingStatus,
    message: headingMsg,
    recommendation: headingRec,
    value: `H1: ${h1Count}`,
  });

  // --- Canonical -------------------------------------------------------------
  const canonical = $('link[rel="canonical"]').attr("href");
  checks.push({
    id: "seo.canonical",
    label: "Canonical",
    status: canonical ? "passed" : "warning",
    message: canonical
      ? `Canonical: ${canonical}`
      : "No hay <link rel=\"canonical\">.",
    recommendation: canonical
      ? undefined
      : "Agregá un canonical para evitar problemas de contenido duplicado.",
    value: canonical ?? null,
  });

  // --- Alt text en imágenes --------------------------------------------------
  const imgs = $("img");
  const total = imgs.length;
  let withAlt = 0;
  imgs.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt !== undefined && alt.trim() !== "") withAlt++;
  });
  if (total === 0) {
    checks.push({
      id: "seo.img-alt",
      label: "Alt text en imágenes",
      status: "info",
      message: "La página no tiene imágenes <img>.",
      value: 0,
    });
  } else {
    const pct = Math.round((withAlt / total) * 100);
    const status = pct === 100 ? "passed" : pct >= 80 ? "warning" : "failed";
    checks.push({
      id: "seo.img-alt",
      label: "Alt text en imágenes",
      status,
      message: `${withAlt} de ${total} imágenes tienen alt (${pct}%).`,
      recommendation:
        status === "passed"
          ? undefined
          : "Agregá texto alternativo descriptivo a todas las imágenes relevantes.",
      value: pct,
    });
  }

  // --- Sitemap + robots.txt (requests extra) --------------------------------
  const origin = getOrigin(ctx.page.finalUrl);
  const [sitemapOk, robotsOk] = await Promise.all([
    resourceExists(`${origin}/sitemap.xml`),
    resourceExists(`${origin}/robots.txt`),
  ]);

  checks.push({
    id: "seo.sitemap",
    label: "Sitemap.xml",
    status: sitemapOk ? "passed" : "warning",
    message: sitemapOk
      ? "Se encontró /sitemap.xml."
      : "No se encontró /sitemap.xml.",
    recommendation: sitemapOk
      ? undefined
      : "Generá un sitemap.xml y referencialo desde robots.txt para ayudar al rastreo.",
    value: sitemapOk,
  });

  checks.push({
    id: "seo.robots-txt",
    label: "robots.txt",
    status: robotsOk ? "passed" : "warning",
    message: robotsOk
      ? "Se encontró /robots.txt."
      : "No se encontró /robots.txt.",
    recommendation: robotsOk
      ? undefined
      : "Agregá un robots.txt para controlar el rastreo de los buscadores.",
    value: robotsOk,
  });

  base.checks = checks;
  base.score = scoreFromChecks(checks, {
    "seo.meta-title": 2,
    "seo.meta-description": 2,
    "seo.meta-robots": 2,
    "seo.headings": 1.5,
  });
  return base;
}

/** HEAD/GET liviano para ver si un recurso existe (200-399). */
async function resourceExists(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "WebAuditBot/0.1" },
    });
    clearTimeout(t);
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}
