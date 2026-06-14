import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuditRow } from "@/lib/types/audit";

export const runtime = "nodejs";

/**
 * GET /api/audit/[id]
 * Devuelve la auditoría por id (lectura pública según RLS).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  // Validación simple de uuid.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "id inválido." }, { status: 400 });
  }

  const supa = createServerSupabase();
  const { data, error } = await supa
    .from("audits")
    .select("*")
    .eq("id", id)
    .maybeSingle<AuditRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }

  return NextResponse.json(data, { status: 200 });
}
