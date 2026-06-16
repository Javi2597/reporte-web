"use client";

import { AuditResult, ModuleKey, MODULE_LABELS } from "@/lib/types/audit";
import { collectQuickWins, summarizeChecks } from "@/lib/utils/report";
import { ScoreRing } from "./ScoreRing";
import { ModuleCard } from "./ModuleCard";

const ORDER: ModuleKey[] = [
  "seo",
  "performance",
  "accessibility",
  "security",
  "code",
];

const IMPACT_BADGE = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
} as const;

const IMPACT_LABEL = { high: "Alto", medium: "Medio", low: "Bajo" } as const;

export function AuditReport({
  audit,
  onReset,
}: {
  audit: AuditResult;
  onReset: () => void;
}) {
  const results = audit.results;
  const overall = audit.scores?.overall ?? 0;

  if (audit.status === "failed" || !results) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-red-400">Auditoría fallida</h1>
        <p className="mt-2 text-slate-400">
          No se pudo completar la auditoría de{" "}
          <span className="text-slate-200">{audit.url}</span>. Puede que el sitio
          no sea accesible públicamente o haya tardado demasiado.
        </p>
        <button
          onClick={onReset}
          className="mt-6 inline-block rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-ink-950 hover:bg-emerald-400"
        >
          Probar otra URL
        </button>
      </div>
    );
  }

  const summary = summarizeChecks(results);
  const quickWins = collectQuickWins(results, 6);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 print:py-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onReset}
          className="text-sm text-slate-400 hover:text-slate-200 print:hidden"
        >
          ← Nueva auditoría
        </button>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-slate-200 hover:bg-ink-700"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Score general */}
      <section className="mt-8 flex flex-col items-center gap-4 rounded-3xl border border-ink-700 bg-ink-800/40 p-8 sm:flex-row sm:gap-10">
        <div className="flex flex-col items-center">
          <ScoreRing score={overall} label="General" />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="truncate text-2xl font-bold text-white">
            {results.meta.finalUrl}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Auditado el{" "}
            {new Date(results.meta.fetchedAt).toLocaleString("es-AR")} ·{" "}
            {(results.meta.durationMs / 1000).toFixed(1)}s
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            {ORDER.map((k) => (
              <div
                key={k}
                className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-sm"
              >
                <span className="text-slate-400">{MODULE_LABELS[k]}: </span>
                <span className="font-semibold text-slate-100">
                  {audit.scores?.[k] ?? "—"}
                </span>
              </div>
            ))}
          </div>

          {/* #5 · Resumen de checks por estado */}
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm sm:justify-start">
            <span className="text-emerald-400">✅ {summary.passed} passed</span>
            <span className="text-amber-400">⚠️ {summary.warning} warnings</span>
            <span className="text-red-400">❌ {summary.failed} failed</span>
            <span className="text-slate-500">
              de {summary.total} verificaciones
            </span>
          </div>
        </div>
      </section>

      {/* #5 · Quick wins priorizados */}
      {quickWins.length > 0 && (
        <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-800/40 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            ⚡ Quick wins
            <span className="text-sm font-normal text-slate-500">
              priorizados por impacto
            </span>
          </h2>
          <ol className="mt-4 space-y-3">
            {quickWins.map((w, i) => {
              const impact = w.check.impact ?? "medium";
              return (
                <li
                  key={w.check.id}
                  className="flex gap-3 border-b border-ink-700/60 pb-3 last:border-0 last:pb-0"
                >
                  <span className="mt-0.5 text-sm font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${IMPACT_BADGE[impact]}`}
                      >
                        {IMPACT_LABEL[impact]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {w.moduleLabel}
                      </span>
                      <span className="font-medium text-slate-200">
                        {w.check.label}
                      </span>
                      {w.check.savingsMs && (
                        <span className="text-xs text-emerald-400">
                          ahorra ~{(w.check.savingsMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-amber-300/90">
                      💡 {w.check.recommendation}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Cards por módulo */}
      <section className="mt-6 space-y-3">
        {ORDER.map((k) => (
          <ModuleCard key={k} module={results[k]} />
        ))}
      </section>

      <p className="mt-10 text-center text-xs text-slate-600">
        WebAudit · Reporte generado automáticamente. Las recomendaciones son
        orientativas.
      </p>
    </main>
  );
}
