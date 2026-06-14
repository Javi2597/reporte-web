import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuditRow, AuditScores } from "@/lib/types/audit";
import { AuditPolling } from "@/components/AuditPolling";

// Siempre datos frescos (el estado puede cambiar de running -> completed).
export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: { id: string };
}) {
  const supa = createServerSupabase();
  const { data } = await supa
    .from("audits")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<AuditRow>();

  if (!data) {
    notFound();
  }

  // #4 · Tendencias: buscamos la auditoría COMPLETADA anterior de la misma URL
  // (creada antes de esta) para mostrar el delta de cada score.
  const { data: prev } = await supa
    .from("audits")
    .select("scores")
    .eq("url", data.url)
    .eq("status", "completed")
    .neq("id", data.id)
    .lt("created_at", data.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ scores: AuditScores | null }>();

  // AuditPolling decide: si ya está completed/failed muestra el reporte; si
  // sigue running, hace polling al GET hasta que termine.
  return <AuditPolling initial={data} previousScores={prev?.scores ?? null} />;
}
