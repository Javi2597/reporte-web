-- ============================================================================
-- WebAudit · Schema de Supabase
-- Ejecutar en el SQL Editor de Supabase (o vía migración).
-- ============================================================================

-- Estado de una auditoría.
do $$ begin
  create type audit_status as enum ('pending', 'running', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

-- Tabla principal de auditorías.
create table if not exists public.audits (
  id          uuid primary key default gen_random_uuid(),
  url         text not null,
  status      audit_status not null default 'pending',
  scores      jsonb,           -- { seo, performance, accessibility, security, code, overall }
  results     jsonb,           -- detalle por módulo (ver lib/types/audit.ts)
  progress    jsonb not null default '{}'::jsonb,  -- estado en vivo por módulo
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users (id) on delete set null  -- null = uso público anónimo
);

-- Si ya tenías la tabla creada, agregá la columna:
alter table public.audits
  add column if not exists progress jsonb not null default '{}'::jsonb;

-- Merge atómico del progreso de un módulo (evita races cuando varios módulos
-- terminan casi simultáneamente). Lo llama el server con la service role key.
create or replace function public.set_audit_progress(
  p_id uuid,
  p_key text,
  p_payload jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  update public.audits
  set progress = coalesce(progress, '{}'::jsonb)
                 || jsonb_build_object(p_key, p_payload)
  where id = p_id;
$$;

-- Índices útiles para el dashboard / rate limiting.
create index if not exists audits_user_id_created_idx
  on public.audits (user_id, created_at desc);
create index if not exists audits_created_at_idx
  on public.audits (created_at desc);

-- Tabla auxiliar para rate limiting por IP (uso público anónimo).
create table if not exists public.audit_rate_limit (
  id          bigint generated always as identity primary key,
  ip          text not null,
  created_at  timestamptz not null default now()
);
create index if not exists audit_rate_limit_ip_created_idx
  on public.audit_rate_limit (ip, created_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.audits enable row level security;

-- Lectura pública: cualquiera puede ver una auditoría por su id (link
-- compartible). Si querés que sea privado, restringí esto.
drop policy if exists "audits_select_public" on public.audits;
create policy "audits_select_public"
  on public.audits for select
  using (true);

-- Inserción/actualización las hace el server con la service role key
-- (bypassa RLS), así que no necesitamos policies de insert para el cliente.
-- Si querés permitir que usuarios autenticados gestionen las suyas:
drop policy if exists "audits_modify_own" on public.audits;
create policy "audits_modify_own"
  on public.audits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- audit_rate_limit solo lo toca el server (service role). RLS on, sin policies.
alter table public.audit_rate_limit enable row level security;
