"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.refresh();
      }}
      className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-slate-200 hover:bg-ink-700"
    >
      Cerrar sesión
    </button>
  );
}
