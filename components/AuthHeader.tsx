"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Encabezado con estado de sesión para la landing.
 * - Deslogueado: link "Iniciar sesión".
 * - Logueado: email + "Historial" + "Cerrar sesión".
 * Reacciona en vivo a login/logout vía onAuthStateChange.
 */
export function AuthHeader() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  // Evita el "flash" hasta saber si hay sesión.
  if (!ready) return <div className="h-9" />;

  const linkCls =
    "rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-ink-700";

  if (!user) {
    return (
      <a href="/dashboard" className={linkCls}>
        Iniciar sesión
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden max-w-[160px] truncate text-slate-400 sm:inline">
        {user.email}
      </span>
      <a href="/dashboard" className={linkCls}>
        Historial
      </a>
      <button onClick={signOut} className={linkCls}>
        Cerrar sesión
      </button>
    </div>
  );
}
