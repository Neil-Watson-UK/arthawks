/*
 * Ledger must use checkout-computed shares so venue_id can mean pickup location
 * without always implying a 15% wall fee.
 */
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
  v_finder integer;
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

  /* Prefer shares written at checkout (pickup venue ≠ fee attribution). */
  if p.artist_share_pence is not null then
    v_artist := p.artist_share_pence;
    v_venue := coalesce(p.venue_share_pence, 0);
    v_finder := coalesce(p.finder_share_pence, 0);
    v_platform := coalesce(
      p.platform_share_pence,
      p.amount_pence - v_artist - v_venue - v_finder
    );
  elsif p.finder_venue_id is not null and coalesce(p.venue_share_pence, 0) = 0 then
    v_artist := floor(p.amount_pence * 70 / 100);
    v_venue := 0;
    v_finder := floor(p.amount_pence * 5 / 100);
    v_platform := p.amount_pence - v_artist - v_finder;
  elsif p.venue_id is not null and coalesce(p.venue_share_pence, 0) > 0 then
    v_artist := floor(p.amount_pence * 70 / 100);
    v_venue := floor(p.amount_pence * 15 / 100);
    v_finder := 0;
    v_platform := p.amount_pence - v_artist - v_venue;
  else
    v_venue := 0;
    v_finder := 0;
    v_platform := floor(p.amount_pence * 15 / 100);
    v_artist := p.amount_pence - v_platform;
  end if;

  update public.purchases
  set
    artist_share_pence = v_artist,
    venue_share_pence = v_venue,
    finder_share_pence = v_finder,
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

  if v_finder > 0 and p.finder_venue_id is not null then
    insert into public.account_balances (party_type, party_id, available_pence, lifetime_pence)
    values ('venue', p.finder_venue_id, v_finder, v_finder)
    on conflict (party_type, party_id) do update
    set
      available_pence = public.account_balances.available_pence + excluded.available_pence,
      lifetime_pence = public.account_balances.lifetime_pence + excluded.lifetime_pence,
      updated_at = now();

    insert into public.ledger_entries (purchase_id, party_type, party_id, amount_pence, kind)
    values (p.id, 'venue', p.finder_venue_id, v_finder, 'finder_credit')
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
