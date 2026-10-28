-- ============================================================================
-- E-SCON cloud database schema (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> Run.
--
-- The app stores its data as JSON documents. To avoid a fragile, hand-written
-- migration of every data shape, this schema is a generic key/value store that
-- mirrors the app's localStorage keys (users, companies, materials, orders,
-- notifications, wallets, wallet_transactions, reviews, system_settings,
-- cart_<userId>, favs_<userId>).
-- ============================================================================

create table if not exists public.escon_kv (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Stay fast as records are upserted.
create index if not exists escon_kv_updated_at_idx on public.escon_kv (updated_at);

alter table public.escon_kv enable row level security;

-- ---------------------------------------------------------------------------
-- POLICIES
--
-- WARNING: these grant the public "anon" key read/write access to ALL app data.
-- That mirrors the current app, which authenticates users in the client only.
-- Before storing real customer data, switch to Supabase Auth and replace these
-- with per-user policies (e.g. only the owner of a row, or role-based rules).
-- ---------------------------------------------------------------------------
drop policy if exists "escon_kv anon read"   on public.escon_kv;
create policy "escon_kv anon read"   on public.escon_kv for select using (true);

drop policy if exists "escon_kv anon insert" on public.escon_kv;
create policy "escon_kv anon insert" on public.escon_kv for insert with check (true);

drop policy if exists "escon_kv anon update" on public.escon_kv;
create policy "escon_kv anon update" on public.escon_kv for update using (true) with check (true);

drop policy if exists "escon_kv anon delete" on public.escon_kv;
create policy "escon_kv anon delete" on public.escon_kv for delete using (true);

-- ---------------------------------------------------------------------------
-- REALTIME
--
-- Publish this table so edits reach other devices immediately. The app also
-- polls `updated_at` as a fallback, so it still converges if this statement has
-- not been run yet, just with a few seconds' delay.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'escon_kv'
  ) then
    alter publication supabase_realtime add table public.escon_kv;
  end if;
end $$;
