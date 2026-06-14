"use client";

import { useEffect, useRef, useState } from "react";
import {
  AuditProgress,
  AuditRow,
  AuditScores,
  MODULE_LABELS,
  ModuleKey,
} from "@/lib/types/audit";
import { scoreColor } from "@/lib/utils/scoring";
import { AuditReport } from "./AuditReport";

const MODULES: ModuleKey[] = [
  "seo",
  "performance",
  "accessibility",
  "security",
  "code",
];

const POLL_INTERVAL_MS = 1500;
// Cortamos el polling tras este tiempo: el server tiene timeout de 30s, damos
// margen. Si sigue "running", asumimos que algo se colgó.
const MAX_POLL_MS = 90_000;

const SCORE_TEXT = {
  good: "text-emerald-400",
  mid: "text-amber-400",
  bad: "text-red-400",
} as const;

type State = "running" | "completed" | "failed" | "timeout";

export function AuditPolling({
  initial,
  previousScores = null,
}: {
  initial: AuditRow;
  previousScores?: AuditScores | null;
}) {
  const [audit, setAudit] = useState<AuditRow>(initial);
  const [state, setState] = useState<State>(
    initial.status === "completed"
      ? "completed"
      : initial.status === "failed"
        ? "failed"
        : "running",
  );
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (state !== "running") return;

    let active = true;
    const interval = setInterval(async () => {
      if (Date.now() - startedAt.current > MAX_POLL_MS) {
        if (active) setState("timeout");
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`/api/audit/${initial.id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: AuditRow = await res.json();
        if (!active) return;
        setAudit(data);
        if (data.status === "completed") {
          setState("completed");
          clearInterval(interval);
        } else if (data.status === "failed") {
          setState("failed");
          clearInterval(interval);
        }
      } catch {
        /* reintenta en el próximo tick */
      }
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [initial.id, state]);

  if (state === "completed" || state === "failed") {
    return <AuditReport audit={audit} previousScores={previousScores} />;
  }

  if (state === "timeout") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-amber-400">
          La auditoría está tardando más de lo esperado
        </h1>
        <p className="mt-2 text-slate-400">
          Podés recargar la página en un momento para ver si terminó.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-ink-950 hover:bg-emerald-400"
        >
          Recargar
        </button>
      </div>
    );
  }

  return <RunningView url={audit.url} progress={audit.progress ?? {}} />;
}

/** Vista de "auditando…" con el progreso real de cada módulo. */
function RunningView({
  url,
  progress,
}: {
  url: string;
  progress: AuditProgress;
}) {
  const done = MODULES.filter((m) => progress[m]).length;
  const pct = Math.round((done / MODULES.length) * 100);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-ink-700 border-t-emerald-500" />
      <h1 className="mt-6 text-2xl font-bold text-white">Analizando sitio…</h1>
      <p className="mt-1 max-w-sm truncate text-center text-sm text-slate-400">
        {url}
      </p>

      {/* Barra de progreso global real */}
      <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {done} de {MODULES.length} módulos listos
      </p>

      <div className="mt-6 w-full space-y-2">
        {MODULES.map((m) => {
          const p = progress[m];
          const isDone = p?.status === "done";
          const isFailed = p?.status === "failed";
          return (
            <div
              key={m}
              className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3"
            >
              <span className="text-lg">
                {isDone ? "✅" : isFailed ? "❌" : "⏳"}
              </span>
              <span
                className={
                  isDone || isFailed ? "text-slate-200" : "text-slate-400"
                }
              >
                {MODULE_LABELS[m]}
              </span>
              <span className="ml-auto text-sm">
                {isDone ? (
                  <span
                    className={`font-semibold ${SCORE_TEXT[scoreColor(p!.score)]}`}
                  >
                    {p!.score}
                  </span>
                ) : isFailed ? (
                  <span className="text-red-400">falló</span>
                ) : (
                  <span className="flex gap-1">
                    <Dot delay="0ms" />
                    <Dot delay="150ms" />
                    <Dot delay="300ms" />
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-slate-600">
        Esto suele tardar entre 10 y 30 segundos. Podés compartir el link de esta
        página; se actualiza solo al terminar.
      </p>
    </main>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
      style={{ animationDelay: delay }}
    />
  );
}
