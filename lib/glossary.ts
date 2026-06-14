// ============================================================================
// Glosario de términos técnicos (en español plano).
// matchGlossary() detecta automáticamente qué términos aparecen en un texto,
// así no hay que etiquetar manualmente cada check.
// ============================================================================

export interface GlossaryEntry {
  /** Término que se muestra como título. */
  term: string;
  /** Variantes que se buscan en el texto (incluí el término principal). */
  aliases: string[];
  /** Explicación en español sencillo. */
  definition: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "LCP (Largest Contentful Paint)",
    aliases: ["LCP", "Largest Contentful Paint"],
    definition:
      "Tiempo hasta que se dibuja el elemento más grande visible (imagen o bloque de texto). Mide qué tan rápido el usuario ve el contenido principal. Ideal: menos de 2,5 s.",
  },
  {
    term: "INP (Interaction to Next Paint)",
    aliases: ["INP", "Interaction to Next Paint"],
    definition:
      "Mide cuánto tarda la página en responder visualmente cuando el usuario interactúa (clics, toques). Reemplazó al FID. Ideal: menos de 200 ms.",
  },
  {
    term: "CLS (Cumulative Layout Shift)",
    aliases: ["CLS", "Cumulative Layout Shift"],
    definition:
      "Mide cuánto se 'mueve' el contenido mientras carga (saltos de layout). Cuanto más estable, mejor. Ideal: menos de 0,1.",
  },
  {
    term: "FCP (First Contentful Paint)",
    aliases: ["FCP", "First Contentful Paint"],
    definition:
      "Tiempo hasta que aparece el primer contenido en pantalla (texto o imagen). Ideal: menos de 1,8 s.",
  },
  {
    term: "TTFB (Time To First Byte)",
    aliases: ["TTFB", "Time To First Byte"],
    definition:
      "Tiempo que tarda el servidor en enviar el primer byte de respuesta. Un TTFB alto suele indicar un servidor o hosting lento. Ideal: menos de 0,8 s.",
  },
  {
    term: "TBT (Total Blocking Time)",
    aliases: ["TBT", "Total Blocking Time"],
    definition:
      "Tiempo total en que la página estuvo 'bloqueada' sin poder responder a interacciones mientras procesaba JavaScript. Se usa como aproximación del INP en laboratorio.",
  },
  {
    term: "Core Web Vitals",
    aliases: ["Core Web Vitals", "Web Vitals"],
    definition:
      "Conjunto de métricas de Google (LCP, INP, CLS) que miden la experiencia real de carga, interactividad y estabilidad visual. Influyen en el posicionamiento en buscadores.",
  },
  {
    term: "CrUX (Chrome UX Report)",
    aliases: ["CrUX", "Chrome UX Report", "datos de campo", "usuarios reales"],
    definition:
      "Base de datos de Google con métricas reales de millones de usuarios de Chrome. Son 'datos de campo' (lo que viven los usuarios), a diferencia de los datos de laboratorio (una carga simulada).",
  },
  {
    term: "p75 (percentil 75)",
    aliases: ["p75", "percentil 75"],
    definition:
      "El valor que el 75% de los usuarios experimenta o mejora. Google usa el p75 para clasificar las Core Web Vitals, en vez del promedio, para no ocultar a los usuarios con peor experiencia.",
  },
  {
    term: "Lighthouse",
    aliases: ["Lighthouse"],
    definition:
      "Herramienta de auditoría automatizada de Google (la que usa PageSpeed Insights). Analiza rendimiento, accesibilidad, SEO y buenas prácticas, y da un puntaje por categoría.",
  },
  {
    term: "Open Graph",
    aliases: ["Open Graph", "og:title", "og:description", "og:image"],
    definition:
      "Etiquetas (og:title, og:image, etc.) que definen cómo se ve la página al compartirla en redes sociales (título, descripción e imagen de la vista previa).",
  },
  {
    term: "Canonical",
    aliases: ["canonical"],
    definition:
      "Etiqueta que indica a los buscadores cuál es la URL 'oficial' de una página, para evitar problemas de contenido duplicado cuando hay varias URLs con el mismo contenido.",
  },
  {
    term: "Sitemap",
    aliases: ["sitemap.xml", "sitemap"],
    definition:
      "Archivo (normalmente /sitemap.xml) que lista las URLs del sitio para ayudar a los buscadores a descubrir y rastrear todas las páginas.",
  },
  {
    term: "robots.txt",
    aliases: ["robots.txt"],
    definition:
      "Archivo en la raíz del sitio que le dice a los buscadores qué partes pueden o no rastrear. También suele apuntar al sitemap.",
  },
  {
    term: "Meta robots / indexable",
    aliases: ["meta robots", "noindex", "indexable"],
    definition:
      "Una página 'indexable' puede aparecer en los resultados de búsqueda. La etiqueta meta robots con 'noindex' le pide a los buscadores que NO la indexen.",
  },
  {
    term: "Meta title",
    aliases: ["meta title", "title"],
    definition:
      "El título de la página que aparece en la pestaña del navegador y como titular azul en los resultados de búsqueda. Ideal: 50-60 caracteres.",
  },
  {
    term: "Meta description",
    aliases: ["meta description", "description"],
    definition:
      "Resumen breve de la página que los buscadores suelen mostrar debajo del título en los resultados. Ideal: 150-160 caracteres.",
  },
  {
    term: "HSTS (Strict-Transport-Security)",
    aliases: ["HSTS", "Strict-Transport-Security"],
    definition:
      "Cabecera de seguridad que obliga al navegador a conectarse siempre por HTTPS, evitando ataques que degradan la conexión a HTTP inseguro.",
  },
  {
    term: "CSP (Content-Security-Policy)",
    aliases: ["CSP", "Content-Security-Policy"],
    definition:
      "Cabecera que define qué recursos (scripts, estilos, imágenes) puede cargar la página. Es una de las defensas más fuertes contra ataques XSS (inyección de código).",
  },
  {
    term: "X-Frame-Options",
    aliases: ["X-Frame-Options"],
    definition:
      "Cabecera que impide que tu sitio sea embebido dentro de un <iframe> en otro dominio, mitigando ataques de clickjacking (engañar al usuario para que haga clic en algo oculto).",
  },
  {
    term: "X-Content-Type-Options",
    aliases: ["X-Content-Type-Options", "nosniff"],
    definition:
      "Cabecera (con valor 'nosniff') que evita que el navegador adivine el tipo de un archivo, previniendo que un recurso malicioso se ejecute como otro tipo.",
  },
  {
    term: "Referrer-Policy",
    aliases: ["Referrer-Policy"],
    definition:
      "Cabecera que controla cuánta información de la URL de origen se envía al navegar a otros sitios, por privacidad.",
  },
  {
    term: "Permissions-Policy",
    aliases: ["Permissions-Policy"],
    definition:
      "Cabecera que limita qué APIs del navegador (cámara, micrófono, geolocalización, etc.) puede usar la página.",
  },
  {
    term: "Mixed content (contenido mixto)",
    aliases: ["mixed content", "contenido mixto"],
    definition:
      "Ocurre cuando una página HTTPS carga recursos por HTTP inseguro (imágenes, scripts). Rompe la seguridad de la conexión y el navegador puede bloquearlos.",
  },
  {
    term: "DOCTYPE",
    aliases: ["DOCTYPE"],
    definition:
      "Declaración (<!DOCTYPE html>) al inicio del documento que le indica al navegador que use el modo estándar de HTML5 para renderizar correctamente.",
  },
  {
    term: "Viewport",
    aliases: ["viewport"],
    definition:
      "La etiqueta meta viewport controla cómo se adapta la página al ancho de la pantalla. Es esencial para que el sitio se vea bien en celulares (responsive).",
  },
  {
    term: "Charset",
    aliases: ["charset"],
    definition:
      "Declaración de codificación de caracteres (normalmente UTF-8). Evita que se vean mal las tildes, eñes y símbolos especiales.",
  },
  {
    term: "defer / async",
    aliases: ["defer", "async"],
    definition:
      "Atributos en las etiquetas <script> que evitan que el JavaScript bloquee el dibujado de la página: 'defer' lo ejecuta al final, 'async' en cuanto se descarga.",
  },
  {
    term: "Alt text (texto alternativo)",
    aliases: ["alt text", "texto alternativo", "atributo alt"],
    definition:
      "Texto que describe una imagen (atributo alt). Lo leen los lectores de pantalla para personas no videntes y ayuda al SEO de imágenes.",
  },
  {
    term: "ARIA",
    aliases: ["ARIA"],
    definition:
      "Conjunto de atributos (roles y propiedades) que aportan información de accesibilidad a los lectores de pantalla cuando el HTML por sí solo no alcanza.",
  },
  {
    term: "Contraste de color",
    aliases: ["contraste", "contrast ratio"],
    definition:
      "Diferencia de luminosidad entre el texto y su fondo. Un contraste bajo dificulta la lectura, sobre todo para personas con baja visión. WCAG exige un mínimo de 4,5:1.",
  },
  {
    term: "DOM",
    aliases: ["DOM"],
    definition:
      "Document Object Model: la estructura en árbol de todos los elementos de la página. Un DOM muy grande (muchos elementos) ralentiza el renderizado.",
  },
  {
    term: "Landmark (punto de referencia)",
    aliases: ["landmark", "main landmark"],
    definition:
      "Regiones semánticas de la página (<main>, <nav>, <header>) que permiten a los lectores de pantalla saltar directo al contenido principal.",
  },
];

/**
 * Devuelve las entradas del glosario cuyos términos aparecen en el texto.
 * Coincidencia case-insensitive con límites de palabra (no matchea 'dom'
 * dentro de 'random'). Sin duplicados, en el orden del glosario.
 */
export function matchGlossary(text: string): GlossaryEntry[] {
  if (!text) return [];
  const found: GlossaryEntry[] = [];
  for (const entry of GLOSSARY) {
    const hit = entry.aliases.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Límite: el carácter inmediatamente antes/después no debe ser alfanumérico.
      const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i");
      return re.test(text);
    });
    if (hit) found.push(entry);
  }
  return found;
}
