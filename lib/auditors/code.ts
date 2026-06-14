import * as cheerio from "cheerio";
import { AuditCheck, AuditContext, ModuleResult } from "@/lib/types/audit";
import { getOrigin } from "@/lib/utils/url";
import { scoreFromChecks } from "@/lib/utils/scoring";

/**
 * Auditor de Código / Buenas prácticas. Analiza el HTML con cheerio y chequea
 * una muestra de links internos para detectar rotos.
 */
export async function auditCode(ctx: AuditContext): Promise<ModuleResult> {
  const base: ModuleResult = {
    key: "code",
    label: "Código",
    score: 0,
    checks: [],
  };

  if (!ctx.page) {
    return { ...base, error: "No se pudo descargar la página." };
  }

  const html = ctx.page.html;
  const $ = cheerio.load(html);
  const checks: AuditCheck[] = [];

  // --- DOCTYPE ---------------------------------------------------------------
  const hasDoctype = /^\s*<!doctype html>/i.test(html);
  checks.push({
    id: "code.doctype",
    label: "DOCTYPE HTML5",
    status: hasDoctype ? "passed" : "warning",
    message: hasDoctype
      ? "Declara <!DOCTYPE html>."
      : "Falta la declaración <!DOCTYPE html> al inicio.",
    recommendation: hasDoctype
      ? undefined
      : "Agregá <!DOCTYPE html> como primera línea del documento.",
    value: hasDoctype,
  });

  // --- lang en <html> --------------------------------------------------------
  const lang = $("html").attr("lang");
  checks.push({
    id: "code.html-lang",
    label: "Atributo lang en <html>",
    status: lang ? "passed" : "failed",
    message: lang ? `lang="${lang}".` : "El <html> no tiene atributo lang.",
    recommendation: lang
      ? undefined
      : 'Agregá el idioma, ej <html lang="es">, para accesibilidad y SEO.',
    value: lang ?? null,
  });

  // --- Viewport --------------------------------------------------------------
  const viewport = $('meta[name="viewport"]').attr("content");
  checks.push({
    id: "code.viewport",
    label: "Meta viewport",
    status: viewport ? "passed" : "failed",
    message: viewport
      ? `viewport: ${viewport}`
      : "Falta la meta viewport (clave para mobile).",
    recommendation: viewport
      ? undefined
      : 'Agregá <meta name="viewport" content="width=device-width, initial-scale=1">.',
    value: viewport ?? null,
  });

  // --- Charset ---------------------------------------------------------------
  const charset =
    $("meta[charset]").attr("charset") ??
    $('meta[http-equiv="Content-Type"]').attr("content");
  checks.push({
    id: "code.charset",
    label: "Charset declarado",
    status: charset ? "passed" : "warning",
    message: charset
      ? `Charset: ${charset}`
      : "No se declara el charset.",
    recommendation: charset
      ? undefined
      : 'Agregá <meta charset="utf-8"> como primer elemento del <head>.',
    value: charset ?? null,
  });

  // --- Scripts con defer/async ----------------------------------------------
  const scripts = $("script[src]");
  const totalScripts = scripts.length;
  let blocking = 0;
  scripts.each((_, el) => {
    const $el = $(el);
    const isModule = ($el.attr("type") ?? "") === "module";
    if (!$el.is("[defer]") && !$el.is("[async]") && !isModule) blocking++;
  });
  if (totalScripts === 0) {
    checks.push({
      id: "code.script-loading",
      label: "Carga de scripts",
      status: "info",
      message: "No hay <script src> externos.",
      value: 0,
    });
  } else {
    const status =
      blocking === 0 ? "passed" : blocking <= 2 ? "warning" : "failed";
    checks.push({
      id: "code.script-loading",
      label: "Scripts con defer/async",
      status,
      message: `${blocking} de ${totalScripts} scripts bloquean el render (sin defer/async/module).`,
      recommendation:
        status === "passed"
          ? undefined
          : "Agregá defer o async a los scripts externos para no bloquear el render.",
      value: blocking,
    });
  }

  // --- Imágenes sin dimensiones ---------------------------------------------
  const imgs = $("img");
  const totalImgs = imgs.length;
  let noDims = 0;
  imgs.each((_, el) => {
    const $el = $(el);
    const w = $el.attr("width");
    const h = $el.attr("height");
    if (!w || !h) noDims++;
  });
  if (totalImgs === 0) {
    checks.push({
      id: "code.img-dimensions",
      label: "Dimensiones de imágenes",
      status: "info",
      message: "No hay imágenes.",
      value: 0,
    });
  } else {
    const status = noDims === 0 ? "passed" : noDims <= 2 ? "warning" : "failed";
    checks.push({
      id: "code.img-dimensions",
      label: "Dimensiones de imágenes",
      status,
      message: `${noDims} de ${totalImgs} imágenes sin width/height declarados.`,
      recommendation:
        status === "passed"
          ? undefined
          : "Declará width y height (o aspect-ratio) en las imágenes para evitar layout shift (CLS).",
      value: noDims,
    });
  }

  // --- Links internos rotos (muestra) ---------------------------------------
  const origin = getOrigin(ctx.page.finalUrl);
  const internalLinks = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      return;
    }
    try {
      const abs = new URL(href, ctx.page!.finalUrl);
      if (abs.origin === origin) {
        abs.hash = "";
        internalLinks.add(abs.toString());
      }
    } catch {
      /* ignore */
    }
  });

  // Limitamos a 15 links para no disparar el timeout.
  const sample = Array.from(internalLinks).slice(0, 15);
  const broken: string[] = [];
  await Promise.all(
    sample.map(async (link) => {
      if (!(await linkOk(link))) broken.push(link);
    }),
  );

  if (sample.length === 0) {
    checks.push({
      id: "code.broken-links",
      label: "Links internos rotos",
      status: "info",
      message: "No se encontraron links internos para chequear.",
      value: 0,
    });
  } else {
    const status =
      broken.length === 0 ? "passed" : broken.length <= 1 ? "warning" : "failed";
    checks.push({
      id: "code.broken-links",
      label: "Links internos rotos",
      status,
      message:
        broken.length === 0
          ? `Se chequearon ${sample.length} links internos: ninguno roto.`
          : `${broken.length} de ${sample.length} links internos rotos.`,
      recommendation:
        broken.length === 0
          ? undefined
          : `Corregí o eliminá: ${broken.slice(0, 3).join(", ")}${
              broken.length > 3 ? "…" : ""
            }`,
      value: broken.length,
    });
  }

  base.checks = checks;
  base.score = scoreFromChecks(checks, {
    "code.html-lang": 1.5,
    "code.viewport": 1.5,
    "code.broken-links": 1.5,
  });
  return base;
}

/** Chequea que un link responda < 400. */
async function linkOk(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "WebAuditBot/0.1" },
    });
    // Algunos servidores no soportan HEAD; reintentamos con GET liviano.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "WebAuditBot/0.1" },
      });
    }
    clearTimeout(t);
    return res.status < 400;
  } catch {
    return false;
  }
}
