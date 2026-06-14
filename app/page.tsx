"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeader } from "@/components/AuthHeader";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("Ingresá una URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al iniciar la auditoría.");
      }
      // El POST responde al instante con el id; la página de resultados
      // muestra el progreso por polling hasta que termine.
      router.push(`/audit/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setLoading(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-16">
      <header className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-4 sm:px-6">
        <span className="text-sm font-semibold text-slate-300">WebAudit</span>
        <AuthHeader />
      </header>

      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-800/60 px-4 py-1 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        Auditoría web en segundos
      </div>

      <h1 className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-center text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
        WebAudit
      </h1>
      <p className="mt-4 max-w-xl text-center text-slate-400">
        Analizá cualquier sitio en SEO, performance, accesibilidad, seguridad y
        código. Puntaje y recomendaciones accionables.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 w-full max-w-xl">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="ejemplo.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="flex-1 rounded-xl border border-ink-700 bg-ink-800 px-5 py-4 text-lg text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-emerald-500 px-8 py-4 text-lg font-semibold text-ink-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Iniciando…" : "Auditar"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </form>

      <a
        href="/dashboard"
        className="mt-10 text-sm text-slate-500 transition hover:text-slate-300"
      >
        Ver historial de auditorías →
      </a>
    </main>
  );
}
