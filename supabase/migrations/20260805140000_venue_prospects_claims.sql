/*
 * Claim-your-venue acquisition:
 * - venue_prospects: OSM candidates (separate from partner venues)
 * - venue_claims: claim requests + admin review
 * - venues.partner_status: verified | active | inactive (sync is_active)
 * - venue_ownership_audit: ownership / status changes
 */

/* ===== enums ===== */
do $$
begin
  if not exists (select 1 from pg_type where typname = 'venue_prospect_lifecycle') then
    create type public.venue_prospect_lifecycle as enum (
      'draft',
      'unclaimed',
      'claim_pending',
      'verified',
      'inactive'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'venue_partner_status') then
    create type public.venue_partner_status as enum (
      'verified',
      'active',
      'inactive'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'venue_claim_status') then
    create type public.venue_claim_status as enum (
      'pending',
      'approved',
      'rejected'
    );
  end if;
end $$;

/* ===== venue_prospects ===== */
create table if not exists public.venue_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  address text,
  locality text,
  postcode text,
  latitude double precision not null,
  longitude double precision not null,
  website text,
  phone text,
  source text not null default 'openstreetmap',
  source_record_id text not null,
  source_url text,
  imported_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  lifecycle_status public.venue_prospect_lifecycle not null default 'draft',
  admin_notes text,
  rejected_reason text,
  merged_into_id uuid references public.venue_prospects (id) on delete set null,
  linked_venue_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_prospects_source_unique unique (source, source_record_id),
  constraint venue_prospects_lat_check check (latitude between -90 and 90),
  constraint venue_prospects_lng_check check (longitude between -180 and 180)
);

create index if not exists venue_prospects_lifecycle_idx
  on public.venue_prospects (lifecycle_status);
create index if not exists venue_prospects_geo_idx
  on public.venue_prospects (latitude, longitude);
create index if not exists venue_prospects_name_idx
  on public.venue_prospects (lower(name));

/* ===== venue_claims ===== */
create table if not exists public.venue_claims (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.venue_prospects (id) on delete cascade,
  claimant_user_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  role_at_venue text not null,
  work_email text not null,
  verification_info text not null,
  message text,
  status public.venue_claim_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venue_claims_prospect_idx on public.venue_claims (prospect_id);
create index if not exists venue_claims_claimant_idx on public.venue_claims (claimant_user_id);
create index if not exists venue_claims_status_idx on public.venue_claims (status);

/* One open claim per prospect */
create unique index if not exists venue_claims_one_pending_per_prospect
  on public.venue_claims (prospect_id)
  where status = 'pending';

/* One open claim per user per prospect */
create unique index if not exists venue_claims_one_pending_per_user_prospect
  on public.venue_claims (prospect_id, claimant_user_id)
  where status = 'pending';

/* ===== venues partner columns ===== */
alter table public.venues
  add column if not exists partner_status public.venue_partner_status,
  add column if not exists prospect_id uuid references public.venue_prospects (id) on delete set null;

/* Backfill: existing active partners stay active; inactive rows stay inactive */
update public.venues
set partner_status = case
  when is_active = true then 'active'::public.venue_partner_status
  else 'inactive'::public.venue_partner_status
end
where partner_status is null;

alter table public.venues
  alter column partner_status set default 'verified'::public.venue_partner_status;

alter table public.venues
  alter column partner_status set not null;

create index if not exists venues_partner_status_idx on public.venues (partner_status);
create unique index if not exists venues_prospect_id_unique
  on public.venues (prospect_id)
  where prospect_id is not null;

/* Keep is_active aligned with partner_status for legacy filters */
create or replace function public.sync_venue_is_active_from_partner_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_status is not null then
    new.is_active := (new.partner_status = 'active');
  elsif new.is_active is not null then
    /* Admin toggled is_active without partner_status — mirror */
    new.partner_status := case
      when new.is_active then 'active'::public.venue_partner_status
      else 'inactive'::public.venue_partner_status
    end;
  end if;
  new.updated_at := coalesce(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists venues_sync_is_active on public.venues;
create trigger venues_sync_is_active
  before insert or update of partner_status, is_active
  on public.venues
  for each row
  execute function public.sync_venue_is_active_from_partner_status();

/* Owners cannot escalate partner_status / is_active themselves */
create or replace function public.prevent_venue_partner_status_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* Service role / SQL editor: no JWT user — allow */
  if coalesce(auth.role(), current_setting('role', true)) = 'service_role' then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and not public.is_admin()
     and (
       new.partner_status is distinct from old.partner_status
       or new.is_active is distinct from old.is_active
       or new.owner_id is distinct from old.owner_id
       or new.prospect_id is distinct from old.prospect_id
     ) then
    raise exception 'Only admins (or service role) may change venue ownership or partner status';
  end if;
  return new;
end;
$$;

drop trigger if exists venues_prevent_status_escalation on public.venues;
create trigger venues_prevent_status_escalation
  before update on public.venues
  for each row
  execute function public.prevent_venue_partner_status_escalation();

/* ===== ownership audit ===== */
create table if not exists public.venue_ownership_audit (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete set null,
  prospect_id uuid references public.venue_prospects (id) on delete set null,
  claim_id uuid references public.venue_claims (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  from_owner_id uuid,
  to_owner_id uuid,
  from_status text,
  to_status text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists venue_ownership_audit_venue_idx
  on public.venue_ownership_audit (venue_id);
create index if not exists venue_ownership_audit_prospect_idx
  on public.venue_ownership_audit (prospect_id);

/* FK from prospects to venues after venues.prospect_id exists */
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'venue_prospects_linked_venue_fk'
      and table_name = 'venue_prospects'
  ) then
    alter table public.venue_prospects
      add constraint venue_prospects_linked_venue_fk
      foreign key (linked_venue_id) references public.venues (id) on delete set null;
  end if;
end $$;

/* ===== RLS: venue_prospects ===== */
alter table public.venue_prospects enable row level security;

drop policy if exists venue_prospects_public_read on public.venue_prospects;
drop policy if exists venue_prospects_admin_all on public.venue_prospects;

create policy venue_prospects_public_read
  on public.venue_prospects for select
  to anon, authenticated
  using (
    lifecycle_status in ('unclaimed', 'claim_pending')
    or public.is_admin()
  );

create policy venue_prospects_admin_write
  on public.venue_prospects for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

/* ===== RLS: venue_claims ===== */
alter table public.venue_claims enable row level security;

drop policy if exists venue_claims_own_select on public.venue_claims;
drop policy if exists venue_claims_own_insert on public.venue_claims;
drop policy if exists venue_claims_own_update on public.venue_claims;
drop policy if exists venue_claims_admin_all on public.venue_claims;

create policy venue_claims_own_select
  on public.venue_claims for select
  to authenticated
  using (claimant_user_id = auth.uid() or public.is_admin());

create policy venue_claims_own_insert
  on public.venue_claims for insert
  to authenticated
  with check (
    claimant_user_id = auth.uid()
    and status = 'pending'
  );

/* Claimants cannot change status — only message fields before review is pointless;
   block updates except admin */
create policy venue_claims_admin_update
  on public.venue_claims for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy venue_claims_admin_delete
  on public.venue_claims for delete
  to authenticated
  using (public.is_admin());

/* ===== RLS: venue_ownership_audit ===== */
alter table public.venue_ownership_audit enable row level security;

drop policy if exists venue_ownership_audit_admin_read on public.venue_ownership_audit;
drop policy if exists venue_ownership_audit_admin_insert on public.venue_ownership_audit;

create policy venue_ownership_audit_admin_read
  on public.venue_ownership_audit for select
  to authenticated
  using (public.is_admin());

create policy venue_ownership_audit_admin_insert
  on public.venue_ownership_audit for insert
  to authenticated
  with check (public.is_admin());

grant select on public.venue_prospects to anon, authenticated;
grant select, insert on public.venue_claims to authenticated;
grant select on public.venue_ownership_audit to authenticated;

comment on table public.venue_prospects is
  'OSM/open-data venue candidates — not Art Hawks partners until claimed and activated';
comment on table public.venue_claims is
  'Claim requests for venue_prospects; admin must approve before venue ownership';
comment on column public.venues.partner_status is
  'verified=owner can edit; active=opted into hangs/map partner; inactive=hidden';
