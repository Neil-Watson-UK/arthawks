/*
 * Sale monetisation: 70% artist / 15% venue / 15% Art Hawks.
 * Credits land on account_balances when a purchase is paid.
 */

alter table public.purchases
  add column if not exists artist_share_pence integer,
  add column if not exists venue_share_pence integer,
  add column if not exists platform_share_pence integer,
  add column if not exists ledger_posted_at timestamptz;

comment on column public.purchases.artist_share_pence is
  '70% of amount_pence when a venue is present; 85% when no venue (keeps venue share).';
comment on column public.purchases.venue_share_pence is
  '15% when hung at a venue; else 0.';
comment on column public.purchases.platform_share_pence is
  'Art Hawks 15% share (plus penny remainder when a venue is present).';

create table if not exists public.account_balances (
  id uuid primary key default gen_random_uuid(),
  party_type text not null check (party_type in ('artist', 'venue', 'platform')),
  party_id uuid not null,
  available_pence integer not null default 0 check (available_pence >= 0),
  lifetime_pence integer not null default 0 check (lifetime_pence >= 0),
  updated_at timestamptz not null default now(),
  unique (party_type, party_id)
);

comment on table public.account_balances is
  'Internal sale balances. Platform uses party_id 00000000-0000-0000-0000-000000000001.';

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete restrict,
  party_type text not null check (party_type in ('artist', 'venue', 'platform')),
  party_id uuid not null,
  amount_pence integer not null check (amount_pence > 0),
  kind text not null default 'sale_credit'
    check (kind in ('sale_credit', 'payout', 'adjustment')),
  created_at timestamptz not null default now(),
  unique (purchase_id, party_type, party_id, kind)
);

create index if not exists ledger_entries_party_idx
  on public.ledger_entries (party_type, party_id, created_at desc);

create index if not exists ledger_entries_purchase_idx
  on public.ledger_entries (purchase_id);

alter table public.account_balances enable row level security;
alter table public.ledger_entries enable row level security;

drop policy if exists account_balances_owner_read on public.account_balances;
create policy account_balances_owner_read on public.account_balances
  for select
  to authenticated
  using (
    (party_type = 'artist' and party_id = auth.uid())
    or (
      party_type = 'venue'
      and party_id in (select v.id from public.venues v where v.owner_id = auth.uid())
    )
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.user_type = 'admin'
      )
    )
  );

drop policy if exists ledger_entries_owner_read on public.ledger_entries;
create policy ledger_entries_owner_read on public.ledger_entries
  for select
  to authenticated
  using (
    (party_type = 'artist' and party_id = auth.uid())
    or (
      party_type = 'venue'
      and party_id in (select v.id from public.venues v where v.owner_id = auth.uid())
    )
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.user_type = 'admin'
      )
    )
  );

create or replace function public.apply_purchase_ledger(p_purchase_id uuid)
returns public.purchases
language plpgsql
security definer
set search_path = public
as $fn$
declare
  p public.purchases;
  v_artist integer;
  v_venue integer;
  v_platform integer;
  v_platform_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  select * into p
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'purchase not found';
  end if;

  if p.ledger_posted_at is not null then
    return p;
  end if;

  if p.status not in ('paid', 'collected') then
    raise exception 'purchase must be paid before ledger credit';
  end if;

  if p.venue_id is not null then
    v_artist := floor(p.amount_pence * 70 / 100);
    v_venue := floor(p.amount_pence * 15 / 100);
    v_platform := p.amount_pence - v_artist - v_venue;
  else
    v_venue := 0;
    v_platform := floor(p.amount_pence * 15 / 100);
    v_artist := p.amount_pence - v_platform;
  end if;

  update public.purchases
  set
    artist_share_pence = v_artist,
    venue_share_pence = v_venue,
    platform_share_pence = v_platform,
    ledger_posted_at = now(),
    updated_at = now()
  where id = p.id
  returning * into p;

  insert into public.account_balances (party_type, party_id, available_pence, lifetime_pence)
  values ('artist', p.artist_id, v_artist, v_artist)
  on conflict (party_type, party_id) do update
  set
    available_pence = public.account_balances.available_pence + excluded.available_pence,
    lifetime_pence = public.account_balances.lifetime_pence + excluded.lifetime_pence,
    updated_at = now();

  insert into public.ledger_entries (purchase_id, party_type, party_id, amount_pence, kind)
  values (p.id, 'artist', p.artist_id, v_artist, 'sale_credit')
  on conflict do nothing;

  if v_venue > 0 and p.venue_id is not null then
    insert into public.account_balances (party_type, party_id, available_pence, lifetime_pence)
    values ('venue', p.venue_id, v_venue, v_venue)
    on conflict (party_type, party_id) do update
    set
      available_pence = public.account_balances.available_pence + excluded.available_pence,
      lifetime_pence = public.account_balances.lifetime_pence + excluded.lifetime_pence,
      updated_at = now();

    insert into public.ledger_entries (purchase_id, party_type, party_id, amount_pence, kind)
    values (p.id, 'venue', p.venue_id, v_venue, 'sale_credit')
    on conflict do nothing;
  end if;

  if v_platform > 0 then
    insert into public.account_balances (party_type, party_id, available_pence, lifetime_pence)
    values ('platform', v_platform_id, v_platform, v_platform)
    on conflict (party_type, party_id) do update
    set
      available_pence = public.account_balances.available_pence + excluded.available_pence,
      lifetime_pence = public.account_balances.lifetime_pence + excluded.lifetime_pence,
      updated_at = now();

    insert into public.ledger_entries (purchase_id, party_type, party_id, amount_pence, kind)
    values (p.id, 'platform', v_platform_id, v_platform, 'sale_credit')
    on conflict do nothing;
  end if;

  return p;
end;
$fn$;

revoke all on function public.apply_purchase_ledger(uuid) from public;
grant execute on function public.apply_purchase_ledger(uuid) to service_role;

do $backfill$
declare
  r record;
begin
  for r in
    select id
    from public.purchases
    where status in ('paid', 'collected')
      and ledger_posted_at is null
  loop
    perform public.apply_purchase_ledger(r.id);
  end loop;
end;
$backfill$;
