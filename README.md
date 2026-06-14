# WebAudit

Auditoría web automática: ingresás una URL y la app corre **5 módulos en paralelo** (SEO, Rendimiento, Accesibilidad, Seguridad y Código) y devuelve un reporte con puntaje, recomendaciones accionables y comparación con auditorías anteriores.

> Pensada primero para uso interno de agencia (auditar sitios de clientes) y luego como SaaS público.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (auth + base de datos).

---

## Características

- **5 módulos de auditoría** corriendo en paralelo, tolerantes a fallos (si uno falla, el resto sigue):
  - **SEO** (cheerio): meta title/description, robots, Open Graph, jerarquía de headings, canonical, sitemap, robots.txt, alt en imágenes.
  - **Rendimiento** (PageSpeed Insights / Lighthouse): scores mobile + desktop, Core Web Vitals de **laboratorio** y de **campo (CrUX, usuarios reales)**, y oportunidades con ahorro estimado en ms/KB.
  - **Accesibilidad** (axe-core vía Lighthouse): violaciones clasificadas por **severidad real** (alta/media/baja) y conteo de elementos afectados.
  - **Seguridad** (headers HTTP): HTTPS, certificado, HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, contenido mixto.
  - **Código** (cheerio): DOCTYPE, lang, viewport, charset, defer/async, dimensiones de imágenes, links internos rotos.
- **Score general** ponderado: SEO 25% · Rendimiento 30% · Accesibilidad 20% · Seguridad 15% · Código 10%.
- **Auditoría asíncrona con polling**: el reporte se genera en segundo plano y la UI muestra el **progreso real por módulo** en vivo.
- **Quick wins** priorizados por impacto, resumen de verificaciones y **tendencias** (delta vs. la auditoría anterior de la misma URL).
- **Glosario desplegable** en español para términos técnicos (LCP, CSP, CLS, etc.).
- **Reporte 100% en español** (incluye los textos de Lighthouse vía `locale=es`).
- **Export a PDF** con un clic (impresión del navegador con estilos optimizados).
- **Auth con Supabase** (email/contraseña), historial en el dashboard, y rate limiting para uso anónimo.

---

## Requisitos

- **Node.js** 18.18+ (recomendado 20+).
- **pnpm** 9+ (`npm i -g pnpm`).
- Una cuenta de **Supabase** (plan gratuito alcanza).
- Una **API key de Google PageSpeed Insights** (gratuita).

---

## Puesta en marcha

### 1. Clonar e instalar

```bash
git clone <tu-repo>
cd auditoria
pnpm install
```

### 2. Crear el proyecto en Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor → New query**, pegá y ejecutá todo el contenido de [`supabase/schema.sql`](supabase/schema.sql). Crea la tabla `audits`, el enum de estado, la columna `progress`, la función `set_audit_progress()`, la tabla de rate limit y las policies de RLS. Es idempotente: lo podés volver a correr sin romper nada.
3. (Recomendado para uso interno) En **Authentication → Sign In / Providers → Email**, desactivá **"Confirm email"** para que el registro deje la sesión iniciada al instante sin pasar por el correo.

### 3. Conseguir la API key de PageSpeed

Seguí [esta guía](https://developers.google.com/speed/docs/insights/v5/get-started) (habilitá "PageSpeed Insights API" en Google Cloud). Sin la key, los módulos de Rendimiento y Accesibilidad quedan sin datos; los otros 3 funcionan igual.

### 4. Variables de entorno

Copiá el ejemplo y completá los valores:

```bash
cp .env.local.example .env.local
```

```env
# Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co     # Project URL (¡no la publishable key!)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                   # anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ...                       # service_role (SECRETA, solo server)

# Google PageSpeed Insights
GOOGLE_PAGESPEED_API_KEY=AIza...

# URL pública de la app (sin trailing slash)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` bypassa la seguridad (RLS). Va **solo** en `.env.local` (gitignored) y nunca en código del cliente.
> Error común: pegar la *publishable key* (`sb_publishable_...`) en `NEXT_PUBLIC_SUPABASE_URL`. Ese campo va la **Project URL** (`https://<ref>.supabase.co`).

### 5. Correr

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
| `pnpm audit:url <url>` | Corre el motor de auditoría contra una URL e imprime el progreso y los hallazgos en consola (no necesita Supabase). |

Hay además scripts de utilidad en [`scripts/`](scripts/):

- `scripts/run-audit.ts` — el runner de `pnpm audit:url`.
- `scripts/check-supabase.ts` — verifica la conexión a Supabase y que el schema esté aplicado.
- `scripts/regen-audit.ts` — regenera/siembra una auditoría escribiendo directo en Supabase (saltea el rate limit; útil para dev).

> **Nota sobre pnpm + esbuild:** pnpm puede bloquear el script de build de `esbuild` (dependencia de `tsx`) y, con eso, trabar `pnpm run`. Si te pasa, ejecutá una vez `pnpm approve-builds` (marcá `esbuild`). Mientras tanto, los scripts se pueden correr directo:
> ```bash
> node --env-file=.env.local --import tsx scripts/run-audit.ts https://tu-sitio.com
> ```

---

## Estructura

```
app/
├─ page.tsx                  Landing: input de URL + login + loading
├─ audit/[id]/page.tsx       Reporte (server) → busca auditoría previa para el delta
├─ dashboard/page.tsx        Historial (requiere auth) o formulario de login
└─ api/
   ├─ audit/route.ts         POST: rate limit → crea fila → corre en background (waitUntil)
   └─ audit/[id]/route.ts    GET: una auditoría por id (para el polling)

lib/
├─ auditors/
│  ├─ index.ts               Orquestador: fetch compartido + progreso por módulo + timeout
│  ├─ seo.ts · performance.ts · accessibility.ts · security.ts · code.ts
├─ supabase/{client,server}.ts
├─ utils/{url,scoring,report}.ts
├─ glossary.ts               Diccionario de términos técnicos + matcher automático
├─ rate-limit.ts
└─ types/audit.ts            Tipos de toda la auditoría

components/                  ScoreRing, ModuleCard, AuditReport, AuditPolling, AuthForm, AuthHeader…
supabase/schema.sql          Schema + función RPC + RLS
scripts/                     Utilidades de dev (audit:url, check-supabase, regen)
```

---

## Cómo funciona (decisiones de diseño)

- **Auditoría asíncrona con polling.** El `POST /api/audit` crea la fila en estado `running`, dispara el trabajo en segundo plano con `waitUntil()` de `@vercel/functions` (Fluid Compute lo mantiene vivo tras responder) y devuelve el `id` al instante. El cliente navega a `/audit/[id]` y consulta el GET cada 1.5 s hasta que termina. En local hay un fallback fire-and-forget. Para escala grande, el siguiente paso es una cola dedicada (Vercel Queues / QStash).
- **Progreso real por módulo.** Cada módulo escribe su estado/score en la columna `progress` (jsonb) apenas termina, mediante la función `set_audit_progress()` que hace un merge atómico (evita races). SEO/Seguridad/Código dependen solo del HTML (rápidos); Rendimiento/Accesibilidad dependen de PageSpeed (más lentos).
- **Accesibilidad sin Puppeteer.** El reporte de accesibilidad de Lighthouse ya está construido sobre axe-core, así que reutilizamos esos resultados en vez de correr Puppeteer + Chromium en serverless (pesado y frágil en Vercel).
- **Fetch compartido.** El HTML se baja una vez (SEO/Seguridad/Código) y PageSpeed se llama una vez por estrategia (Rendimiento/Accesibilidad).
- **Rate limiting.** 5 auditorías por hora por IP solo para usuarios **anónimos** (tabla `audit_rate_limit`). Los usuarios logueados no tienen límite. Configurable en `lib/rate-limit.ts`.
- **Español.** Los textos propios están en español y a PageSpeed se le pide `locale=es` para que Lighthouse devuelva títulos y descripciones traducidos.

---

## Notas de seguridad

- `.env.local`, `.next/` y `node_modules/` están gitignoreados: las claves nunca se suben.
- La `anon key` es pública por diseño (respeta RLS); la `service_role` es secreta y solo se usa en el server.
- RLS está activado en `audits` con lectura pública por id (link compartible). Ajustá las policies en `supabase/schema.sql` si querés reportes privados.
