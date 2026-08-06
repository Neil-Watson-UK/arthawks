/*
 * Rotations, busy periods, co-ownership proposals, and QR scan pulse.
 */

alter table public.matches
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists install_buffer_hours integer not null default 24,
  add column if not exists wall_label text,
  add column if not exists reminder_at timestamptz,
  add column if not exists approved_at timestamptz;

do $$ begin
  create type public.proposal_type as enum ('swap', 'mood', 'size', 'hang');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.proposal_status as enum ('open', 'accepted', 'declined', 'withdrawn');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scan_source as enum ('wall_qr', 'share', 'unknown');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scan_condition as enum ('good', 'needs_attention', 'damaged');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scan_interest as enum ('browse', 'love', 'buy_ask');
exception when duplicate_object then null;
end $$;

create table if not exists public.venue_busy_periods (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint venue_busy_periods_range check (ends_on >= starts_on)
);

create table if not exists public.placement_proposals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  from_profile_id uuid not null references public.profiles (id) on delete cascade,
  to_profile_id uuid not null references public.profiles (id) on delete cascade,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  proposal_type public.proposal_type not null default 'hang',
  message text,
  requested_mood text,
  requested_min_cm numeric,
  requested_max_cm numeric,
  status public.proposal_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  match_id uuid references public.matches (id) on delete set null,
  venue_id uuid references public.profiles (id) on delete set null,
  scanned_at timestamptz not null default now(),
  source public.scan_source not null default 'wall_qr',
  condition public.scan_condition,
  interest_level public.scan_interest,
  lat numeric,
  lng numeric,
  user_id uuid references public.profiles (id) on delete set null,
  content text
);

create index if not exists venue_busy_periods_venue_idx on public.venue_busy_periods (venue_id, starts_on);
create index if not exists placement_proposals_to_idx on public.placement_proposals (to_profile_id, status);
create index if not exists placement_proposals_from_idx on public.placement_proposals (from_profile_id, status);
create index if not exists qr_scans_artwork_idx on public.qr_scans (artwork_id, scanned_at desc);
create index if not exists qr_scans_venue_idx on public.qr_scans (venue_id, scanned_at desc);

alter table public.venue_busy_periods enable row level security;
alter table public.placement_proposals enable row level security;
alter table public.qr_scans enable row level security;

drop policy if exists "Prototype public read busy" on public.venue_busy_periods;
create policy "Prototype public read busy" on public.venue_busy_periods for select using (true);
drop policy if exists "Prototype public write busy" on public.venue_busy_periods;
create policy "Prototype public write busy" on public.venue_busy_periods for all using (true) with check (true);

drop policy if exists "Prototype public read proposals" on public.placement_proposals;
create policy "Prototype public read proposals" on public.placement_proposals for select using (true);
drop policy if exists "Prototype public write proposals" on public.placement_proposals;
create policy "Prototype public write proposals" on public.placement_proposals for all using (true) with check (true);

drop policy if exists "Prototype public read scans" on public.qr_scans;
create policy "Prototype public read scans" on public.qr_scans for select using (true);
drop policy if exists "Prototype public write scans" on public.qr_scans;
create policy "Prototype public write scans" on public.qr_scans for all using (true) with check (true);

/* Seed a holiday block for The Gallimaufry */
insert into public.venue_busy_periods (venue_id, starts_on, ends_on, reason)
select
  'c0000000-0000-4000-8000-000000000001'::uuid,
  date '2026-08-24',
  date '2026-08-31',
  'August bank holiday week — walls rest'
where not exists (
  select 1 from public.venue_busy_periods
  where venue_id = 'c0000000-0000-4000-8000-000000000001'
    and starts_on = date '2026-08-24'
);
