# WebAudit

Auditoría web automática: ingresás una URL y la app corre **5 módulos en paralelo** (SEO, Rendimiento, Accesibilidad, Seguridad y Código) y devuelve un reporte con puntaje, recomendaciones accionables y comparación con auditorías anteriores.

> Pensada para uso directo: pegás una URL y obtenés el reporte al instante. Sin cuentas ni base de datos — los reportes son efímeros.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS.

---

## Características

- **5 módulos de auditoría** corriendo en paralelo, tolerantes a fallos (si uno falla, el resto sigue):
  - **SEO** (cheerio): meta title/description, robots, Open Graph, jerarquía de headings, canonical, sitemap, robots.txt, alt en imágenes.
  - **Rendimiento** (PageSpeed Insights / Lighthouse): scores mobile + desktop, Core Web Vitals de **laboratorio** y de **campo (CrUX, usuarios reales)**, y oportunidades con ahorro estimado en ms/KB.
  - **Accesibilidad** (axe-core vía Lighthouse): violaciones clasificadas por **severidad real** (alta/media/baja) y conteo de elementos afectados.
  - **Seguridad** (headers HTTP): HTTPS, certificado, HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, contenido mixto.
  - **Código** (cheerio): DOCTYPE, lang, viewport, charset, defer/async, dimensiones de imágenes, links internos rotos.
- **Score general** ponderado: SEO 25% · Rendimiento 30% · Accesibilidad 20% · Seguridad 15% · Código 10%.
- **Auditoría síncrona**: pegás la URL, esperás unos segundos y la misma respuesta trae el reporte completo. Sin persistencia.
- **Quick wins** priorizados por impacto y resumen de verificaciones.
- **Glosario desplegable** en español para términos técnicos (LCP, CSP, CLS, etc.).
- **Reporte 100% en español** (incluye los textos de Lighthouse vía `locale=es`).
- **Export a PDF** con un clic (impresión del navegador con estilos optimizados).

---

## Requisitos

- **Node.js** 18.18+ (recomendado 20+).
- **pnpm** 9+ (`npm i -g pnpm`).
- Una **API key de Google PageSpeed Insights** (gratuita).

---

## Puesta en marcha

### 1. Clonar e instalar

```bash
git clone <tu-repo>
cd auditoria
pnpm install
```

### 2. Conseguir la API key de PageSpeed

Seguí [esta guía](https://developers.google.com/speed/docs/insights/v5/get-started) (habilitá "PageSpeed Insights API" en Google Cloud). Sin la key, los módulos de Rendimiento y Accesibilidad quedan sin datos; los otros 3 funcionan igual.

### 3. Variables de entorno

Copiá el ejemplo y completá los valores:

```bash
cp .env.local.example .env.local
```

```env
# Google PageSpeed Insights
GOOGLE_PAGESPEED_API_KEY=AIza...
```

### 4. Correr

```bash
pnpm dev          # http://localhost:3000
```

---

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo. |
| `pnpm build` | Build de producción. |
| `pnpm start` | Sirve el build. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm audit:url <url>` | Corre el motor de auditoría contra una URL e imprime el progreso y los hallazgos en consola. |

Hay además un script de utilidad en [`scripts/`](scripts/):

- `scripts/run-audit.ts` — el runner de `pnpm audit:url`.

> **Nota sobre pnpm + esbuild:** pnpm puede bloquear el script de build de `esbuild` (dependencia de `tsx`) y, con eso, trabar `pnpm run`. Si te pasa, ejecutá una vez `pnpm approve-builds` (marcá `esbuild`). Mientras tanto, los scripts se pueden correr directo:
> ```bash
> node --env-file=.env.local --import tsx scripts/run-audit.ts https://tu-sitio.com
> ```

---

## Estructura

```
app/
├─ page.tsx                  Landing: input de URL → corre la auditoría → muestra el reporte
└─ api/
   └─ audit/route.ts         POST: corre la auditoría y devuelve el reporte completo

lib/
├─ auditors/
│  ├─ index.ts               Orquestador: fetch compartido + timeout
│  ├─ seo.ts · performance.ts · accessibility.ts · security.ts · code.ts
├─ utils/{url,scoring,report}.ts
├─ glossary.ts               Diccionario de términos técnicos + matcher automático
└─ types/audit.ts            Tipos de toda la auditoría

components/                  ScoreRing, ModuleCard, AuditReport…
scripts/                     Utilidad de dev (audit:url)
```

---

## Cómo funciona (decisiones de diseño)

- **Auditoría síncrona.** El `POST /api/audit` corre los 5 módulos y devuelve el reporte completo en la misma respuesta. El motor tiene un timeout interno de 30 s y la función un `maxDuration` de 60 s. El resultado es efímero: vive en el estado del cliente, no se persiste. Para escala grande con historial, el siguiente paso sería reintroducir una cola + almacén (Vercel Queues / QStash + una DB).
- **Accesibilidad sin Puppeteer.** El reporte de accesibilidad de Lighthouse ya está construido sobre axe-core, así que reutilizamos esos resultados en vez de correr Puppeteer + Chromium en serverless (pesado y frágil en Vercel).
- **Fetch compartido.** El HTML se baja una vez (SEO/Seguridad/Código) y PageSpeed se llama una vez por estrategia (Rendimiento/Accesibilidad).
- **Español.** Los textos propios están en español y a PageSpeed se le pide `locale=es` para que Lighthouse devuelva títulos y descripciones traducidos.

---

## Notas de seguridad

- `.env.local`, `.next/` y `node_modules/` están gitignoreados: las claves nunca se suben.
- La `GOOGLE_PAGESPEED_API_KEY` solo se usa en el server (la API route). No se expone al cliente.
