"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Login / signup con email + password (Supabase Auth). */
export function AuthForm() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo(
          "Cuenta creada. Si la confirmación por email está activada, revisá tu casilla.",
        );
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de autenticación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-center text-2xl font-bold text-white">
        {mode === "login" ? "Iniciá sesión" : "Creá tu cuenta"}
      </h1>
      <p className="mt-2 text-center text-sm text-slate-400">
        Accedé a tu historial de auditorías.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-3">
        <input
          type="email"
          required
          placeholder="email@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-white outline-none focus:border-emerald-500"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-white outline-none focus:border-emerald-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-emerald-400">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-500 py-3 font-semibold text-ink-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading
            ? "Procesando…"
            : mode === "login"
              ? "Entrar"
              : "Registrarme"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode((m) => (m === "login" ? "signup" : "login"));
          setError(null);
          setInfo(null);
        }}
        className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-200"
      >
        {mode === "login"
          ? "¿No tenés cuenta? Registrate"
          : "¿Ya tenés cuenta? Iniciá sesión"}
      </button>
    </div>
  );
}
