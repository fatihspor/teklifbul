-- TeklifBul initial Supabase/Postgres schema
-- Run in Supabase SQL editor after configuring Google OAuth in Auth.
-- All writes require an authenticated user. Offers are private to their author and job owner.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'both' check (role in ('customer','provider','both')),
  created_at timestamptz not null default now()
);
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  category text not null check (char_length(category) between 2 and 120),
  province text not null,
  district text not null,
  neighborhood text not null,
  description text not null check (char_length(description) between 10 and 1500),
  budget_note text,
  status text not null default 'open' check (status in ('open','awarded','completed','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique(job_id,provider_id)
);
create index if not exists jobs_status_created_idx on public.jobs(status,created_at desc);
create index if not exists offers_job_idx on public.offers(job_id);
create index if not exists offers_provider_idx on public.offers(provider_id);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.offers enable row level security;

-- Public profiles intentionally expose only display_name and role; avoid storing private contact data here.
create policy "Read profiles" on public.profiles for select to anon,authenticated using (true);
create policy "Create own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "Edit own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Browse open jobs or own jobs" on public.jobs for select to anon,authenticated
using (status = 'open' or owner_id = (select auth.uid()));
create policy "Post own job" on public.jobs for insert to authenticated
with check (owner_id = (select auth.uid()) and status = 'open');
create policy "Update own job" on public.jobs for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- Do not grant deletion: preserve records for moderation and audit.

-- A provider sees only their own offer; the job owner sees all offers on their job.
create policy "Private offers" on public.offers for select to authenticated
using (provider_id = (select auth.uid()) or exists (
  select 1 from public.jobs j where j.id = job_id and j.owner_id = (select auth.uid())
));
create policy "Submit own offer to other open job" on public.offers for insert to authenticated
with check (provider_id = (select auth.uid()) and exists (
  select 1 from public.jobs j where j.id = job_id and j.status = 'open' and j.owner_id <> (select auth.uid())
));
-- No update or delete policy: offers are immutable in MVP.

-- Public count of offers only, without leaking amounts, authors or ranking.
create or replace function public.offer_count(p_job_id uuid)
returns bigint language sql stable security definer set search_path = ''
as $$
  select count(*) from public.offers o
  join public.jobs j on j.id = o.job_id
  where o.job_id = p_job_id and (j.status = 'open' or j.owner_id = (select auth.uid()));
$$;
revoke all on function public.offer_count(uuid) from public;
grant execute on function public.offer_count(uuid) to anon,authenticated;

-- Harden column privileges: clients cannot override owner/provider fields via update.
revoke all on public.profiles,public.jobs,public.offers from anon,authenticated;
grant select on public.profiles,public.jobs to anon;
grant select,insert on public.profiles,public.jobs,public.offers to authenticated;
grant update(display_name,role) on public.profiles to authenticated;
grant update(status,description,budget_note) on public.jobs to authenticated;
