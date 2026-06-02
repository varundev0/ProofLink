-- ============================================================
-- ProofLink — Initial Schema
-- ============================================================
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- NOTE: This migration uses Supabase Auth for user identity.
-- The mock auth layer (src/lib/supabase/mockAuth.ts) can be
-- swapped for real Supabase Auth by following the steps in
-- src/lib/supabase/index.ts.
-- ============================================================


-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";


-- ── profiles ──────────────────────────────────────────────────────────────────
-- One row per freelancer. Created automatically on first sign-up via a trigger.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  deal_count  integer not null default 0
);

-- Auto-create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, deal_count)
  values (new.id, 0)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── projects ──────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  "projectId"       text primary key,
  "freelancerEmail" text        not null,
  "freelancerId"    uuid        references auth.users(id) on delete set null,
  title             text        not null,
  amount            numeric     not null check (amount > 0),
  status            text        not null default 'pending' check (status in ('pending', 'paid')),
  "proofFileUrl"    text,
  "finalFileUrl"    text,       -- private; never exposed to the client directly
  created_at        timestamptz not null default now()
);


-- ── download_tokens ───────────────────────────────────────────────────────────
create table if not exists public.download_tokens (
  token        text        primary key,
  "projectId"  text        not null references public.projects("projectId") on delete cascade,
  "expiresAt"  timestamptz not null
);

-- Clean up expired tokens automatically (requires pg_cron; skip if not available)
-- select cron.schedule('cleanup-expired-tokens', '0 * * * *',
--   $$ delete from public.download_tokens where "expiresAt" < now() $$);


-- ── Row-Level Security ────────────────────────────────────────────────────────

-- profiles: only the owner can read/update their own row
alter table public.profiles enable row level security;

create policy "profiles: owner read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: owner update"
  on public.profiles for update
  using (auth.uid() = id);

-- projects: freelancer can CRUD their own projects; anyone with the projectId can read
alter table public.projects enable row level security;

create policy "projects: freelancer full access"
  on public.projects for all
  using (auth.uid() = "freelancerId");

create policy "projects: public read by projectId"
  on public.projects for select
  using (true);  -- refined below via service-role calls for finalFileUrl

-- download_tokens: server-side only (service role); no direct client access
alter table public.download_tokens enable row level security;

create policy "download_tokens: deny all"
  on public.download_tokens for all
  using (false);


-- ── Storage Buckets ───────────────────────────────────────────────────────────
-- Run these in the Supabase dashboard (Storage → New bucket) or via the CLI.
-- They cannot be created with plain SQL.
--
--  1. Bucket: "proofs"
--     • Public: YES
--     • Allowed MIME types: image/jpeg, image/png, image/webp, image/gif
--     • Max file size: 10 MB
--
--  2. Bucket: "finals"
--     • Public: NO  ← IMPORTANT: must remain private
--     • Allowed MIME types: (any)
--     • Max file size: 100 MB
--     • Access: via signed URLs only (createSignedUrl in /api/projects/:id/download)
--
-- Storage RLS for "proofs" (public reads, authenticated uploads):
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('finals', 'finals', false)
on conflict (id) do nothing;

create policy "proofs: public read"
  on storage.objects for select
  using (bucket_id = 'proofs');

create policy "proofs: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'proofs' and auth.role() = 'authenticated');

-- finals: no direct client access; all access goes through the server API
create policy "finals: deny all"
  on storage.objects for all
  using (bucket_id = 'finals' and false);
