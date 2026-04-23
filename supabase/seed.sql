-- Zoho Email Automation — Supabase schema
-- Run this in the Supabase SQL editor after creating the project.
-- Idempotent: safe to re-run after upgrading from an earlier version.

create extension if not exists "pgcrypto";

-- === templates ===================================================
create table if not exists public.templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  subject      text not null default '',
  html_body    text not null default '',
  attachments  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists templates_user_idx on public.templates(user_id);

-- === automations =================================================
do $$ begin
  create type automation_status as enum ('active', 'paused');
exception when duplicate_object then null; end $$;

create table if not exists public.automations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  nl_prompt     text not null,
  parsed_rule   jsonb not null,
  template_id   uuid references public.templates(id) on delete set null,
  schedule_cron text not null,
  timezone      text not null default 'America/Los_Angeles',
  status        automation_status not null default 'active',
  test_mode     boolean not null default true,
  next_run_at   timestamptz,
  last_run_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- upgrade-safe: add column if the table pre-existed
alter table public.automations add column if not exists test_mode boolean not null default true;

create index if not exists automations_user_idx on public.automations(user_id);
create index if not exists automations_due_idx  on public.automations(next_run_at)
  where status = 'active';

-- === runs ========================================================
do $$ begin
  create type run_status as enum ('success', 'error', 'skipped', 'pending_approval', 'approved');
exception when duplicate_object then null; end $$;

-- upgrade-safe: add new enum values if the type already existed
do $$ begin
  alter type run_status add value if not exists 'pending_approval';
exception when others then null; end $$;
do $$ begin
  alter type run_status add value if not exists 'approved';
exception when others then null; end $$;

create table if not exists public.runs (
  id                uuid primary key default gen_random_uuid(),
  automation_id     uuid not null references public.automations(id) on delete cascade,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  recipient_count   integer not null default 0,
  zoho_campaign_id  text,
  status            run_status not null default 'success',
  error             text,
  snapshot          jsonb,        -- {subject, html, emails[], campaignName}
  approval_token    uuid,         -- present when status='pending_approval'
  approved_at       timestamptz
);
alter table public.runs add column if not exists snapshot jsonb;
alter table public.runs add column if not exists approval_token uuid;
alter table public.runs add column if not exists approved_at timestamptz;

create index if not exists runs_automation_idx on public.runs(automation_id, started_at desc);
create index if not exists runs_pending_idx    on public.runs(approval_token) where approval_token is not null;

-- === updated_at trigger ==========================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists set_updated_at_templates on public.templates;
create trigger set_updated_at_templates
  before update on public.templates
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_automations on public.automations;
create trigger set_updated_at_automations
  before update on public.automations
  for each row execute function public.set_updated_at();

-- === row level security ==========================================
alter table public.templates   enable row level security;
alter table public.automations enable row level security;
alter table public.runs        enable row level security;

drop policy if exists "templates owner" on public.templates;
create policy "templates owner" on public.templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "automations owner" on public.automations;
create policy "automations owner" on public.automations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "runs owner" on public.runs;
create policy "runs owner" on public.runs
  for select using (
    exists (select 1 from public.automations a
            where a.id = runs.automation_id and a.user_id = auth.uid())
  );

-- === storage bucket =============================================
insert into storage.buckets (id, name, public)
values ('email-assets', 'email-assets', true)
on conflict (id) do nothing;

drop policy if exists "email-assets read" on storage.objects;
create policy "email-assets read" on storage.objects
  for select using (bucket_id = 'email-assets');

drop policy if exists "email-assets write" on storage.objects;
create policy "email-assets write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'email-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "email-assets delete" on storage.objects;
create policy "email-assets delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'email-assets' and (storage.foldername(name))[1] = auth.uid()::text);
