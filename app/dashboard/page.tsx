import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuditRow, MODULE_LABELS, ModuleKey } from "@/lib/types/audit";
import { AuthForm } from "@/components/AuthForm";
import { SignOutButton } from "@/components/SignOutButton";
import { scoreColor } from "@/lib/utils/scoring";

export const dynamic = "force-dynamic";

const ORDER: ModuleKey[] = [
  "seo",
  "performance",
  "accessibility",
  "security",
  "code",
];

const SCORE_TEXT = {
  good: "text-emerald-400",
  mid: "text-amber-400",
  bad: "text-red-400",
} as const;

function ScoreCell({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-slate-600">—</span>;
  }
  return (
    <span className={`font-semibold ${SCORE_TEXT[scoreColor(score)]}`}>
      {score}
    </span>
  );
}

export default async function DashboardPage() {
  const supa = createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    return <AuthForm />;
  }

  const { data: audits } = await supa
    .from("audits")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<AuditRow[]>();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← WebAudit
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-white">
            Historial de auditorías
          </h1>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-emerald-400"
          >
            Nueva auditoría
          </Link>
          <SignOutButton />
        </div>
      </div>

      {!audits || audits.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-ink-700 py-16 text-center text-slate-400">
          Todavía no tenés auditorías.{" "}
          <Link href="/" className="text-emerald-400 hover:underline">
            Creá la primera →
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-ink-700">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-ink-800/60 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-center">General</th>
                {ORDER.map((k) => (
                  <th key={k} className="px-3 py-3 text-center">
                    {MODULE_LABELS[k].slice(0, 4)}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {audits.map((a) => (
                <tr key={a.id} className="hover:bg-ink-800/40">
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-200">
                    {a.url}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                    {new Date(a.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {a.status === "completed" ? (
                      <ScoreCell score={a.scores?.overall} />
                    ) : (
                      <span className="text-xs text-slate-500">{a.status}</span>
                    )}
                  </td>
                  {ORDER.map((k) => (
                    <td key={k} className="px-3 py-3 text-center">
                      <ScoreCell score={a.scores?.[k]} />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/audit/${a.id}`}
                      className="text-emerald-400 hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
