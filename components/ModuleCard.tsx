"use client";

import { useState } from "react";
import { AuditCheck, ModuleResult } from "@/lib/types/audit";
import { scoreColor } from "@/lib/utils/scoring";
import { matchGlossary } from "@/lib/glossary";

const SCORE_TEXT = {
  good: "text-emerald-400",
  mid: "text-amber-400",
  bad: "text-red-400",
} as const;

const SCORE_BORDER = {
  good: "border-emerald-500/30",
  mid: "border-amber-500/30",
  bad: "border-red-500/30",
} as const;

const CHECK_ICON: Record<AuditCheck["status"], string> = {
  passed: "✅",
  warning: "⚠️",
  failed: "❌",
  info: "ℹ️",
};

const IMPACT_BADGE = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
} as const;

const IMPACT_LABEL = { high: "Alto", medium: "Medio", low: "Bajo" } as const;

export function ModuleCard({ module }: { module: ModuleResult }) {
  const [open, setOpen] = useState(false);
  const color = scoreColor(module.score);

  const counts = module.checks.reduce(
    (acc, c) => {
      acc[c.status]++;
      return acc;
    },
    { passed: 0, warning: 0, failed: 0, info: 0 } as Record<
      AuditCheck["status"],
      number
    >,
  );

  return (
    <div
      className={`rounded-2xl border bg-ink-800/50 ${SCORE_BORDER[color]} overflow-hidden`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-ink-700/30"
        aria-expanded={open}
      >
        <div className="flex flex-col">
          <span className="text-sm uppercase tracking-wide text-slate-400">
            {module.label}
          </span>
          <span className={`text-3xl font-bold ${SCORE_TEXT[color]}`}>
            {module.error ? "—" : module.score}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
          {module.error ? (
            <span className="text-red-400">Falló</span>
          ) : (
            <>
              <span title="Passed">✅ {counts.passed}</span>
              <span title="Warnings">⚠️ {counts.warning}</span>
              <span title="Failed">❌ {counts.failed}</span>
            </>
          )}
          <span
            className={`transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </button>

      {/* El panel se renderiza siempre en el DOM: oculto en pantalla cuando
          está colapsado, pero visible al imprimir (print:block) para que el
          PDF incluya todos los checks de todos los módulos. */}
      <div
        className={`border-t border-ink-700 px-5 py-4 ${
          open ? "" : "hidden print:block"
        }`}
      >
        {module.error ? (
          <p className="text-sm text-red-400">{module.error}</p>
        ) : (
          <ul className="space-y-3">
            {module.checks.map((c) => {
              const terms = matchGlossary(`${c.label} ${c.message}`);
              return (
                <li key={c.id} className="flex gap-3">
                  <span className="mt-0.5">{CHECK_ICON[c.status]}</span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-200">
                      {c.label}
                      {(c.status === "failed" || c.status === "warning") &&
                        c.impact && (
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${IMPACT_BADGE[c.impact]}`}
                          >
                            {IMPACT_LABEL[c.impact]}
                          </span>
                        )}
                    </p>
                    <p className="text-sm text-slate-400">{c.message}</p>
                    {c.recommendation && (
                      <p className="mt-1 text-sm text-amber-300/90">
                        💡 {c.recommendation}
                      </p>
                    )}
                    {terms.length > 0 && (
                      <details className="group mt-1.5 print:hidden">
                        <summary className="cursor-pointer list-none text-xs text-sky-400 hover:text-sky-300">
                          <span className="group-open:hidden">
                            ℹ️ ¿Qué significa? ({terms.length}{" "}
                            {terms.length === 1 ? "término" : "términos"})
                          </span>
                          <span className="hidden group-open:inline">
                            ℹ️ Términos técnicos
                          </span>
                        </summary>
                        <dl className="mt-2 space-y-2 rounded-lg border border-ink-700 bg-ink-900/60 p-3">
                          {terms.map((t) => (
                            <div key={t.term}>
                              <dt className="text-xs font-semibold text-slate-200">
                                {t.term}
                              </dt>
                              <dd className="text-xs leading-relaxed text-slate-400">
                                {t.definition}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
