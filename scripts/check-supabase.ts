/**
 * Verifica la conexión a Supabase y que el schema esté aplicado.
 * Uso: node --env-file=.env.local --import tsx scripts/check-supabase.ts
 */
import { createClient } from "@supabase/supabase-js";

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};
const ok = (m: string) => console.log(`${c.green}✓${c.reset} ${m}`);
const fail = (m: string) => console.log(`${c.red}✗ ${m}${c.reset}`);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log(`\n${c.bold}Chequeo de Supabase${c.reset}`);
  console.log(`${c.dim}URL: ${url}${c.reset}\n`);

  if (!url || !serviceKey || !anon) {
    fail("Faltan variables de entorno (URL / anon / service_role).");
    process.exit(1);
  }
  ok("Variables de entorno presentes (URL, anon, service_role).");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Tabla audits accesible.
  const { error: auditsErr, count } = await admin
    .from("audits")
    .select("*", { count: "exact", head: true });
  if (auditsErr) {
    fail(`Tabla 'audits': ${auditsErr.message}`);
    process.exit(1);
  }
  ok(`Tabla 'audits' accesible (${count ?? 0} filas).`);

  // 2. Tabla audit_rate_limit accesible.
  const { error: rlErr } = await admin
    .from("audit_rate_limit")
    .select("*", { head: true });
  if (rlErr) {
    fail(`Tabla 'audit_rate_limit': ${rlErr.message}`);
    process.exit(1);
  }
  ok("Tabla 'audit_rate_limit' accesible.");

  // 3. Función RPC set_audit_progress existe (la llamamos con un id inexistente:
  //    no actualiza nada, pero si la función no existe da error 404).
  const { error: rpcErr } = await admin.rpc("set_audit_progress", {
    p_id: "00000000-0000-0000-0000-000000000000",
    p_key: "seo",
    p_payload: { status: "done", score: 0 },
  });
  if (rpcErr) {
    fail(`Función 'set_audit_progress': ${rpcErr.message}`);
    console.log(
      `${c.dim}  → ¿Corriste supabase/schema.sql completo en el SQL Editor?${c.reset}`,
    );
    process.exit(1);
  }
  ok("Función 'set_audit_progress' existe y es invocable.");

  // 4. Insert + delete de prueba (verifica permisos de escritura).
  const { data: ins, error: insErr } = await admin
    .from("audits")
    .insert({ url: "https://__healthcheck__.test", status: "pending" })
    .select("id")
    .single();
  if (insErr || !ins) {
    fail(`Insert de prueba: ${insErr?.message}`);
    process.exit(1);
  }
  await admin.from("audits").delete().eq("id", ins.id);
  ok("Insert + delete de prueba OK (escritura con service_role).");

  console.log(`\n${c.green}${c.bold}Conexión a Supabase OK ✔${c.reset}\n`);
}

main().catch((e) => {
  fail(`Error inesperado: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
