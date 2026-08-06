/*
 * Art Hawks — wipe catalogue + commerce history for real artist invites.
 *
 * KEEPS
 *   - All profiles with user_type = 'admin' (and their auth.users)
 *   - Venue(s) whose name matches '%Old Library%' (case-insensitive)
 *   - The venue owner profile(s) for those venues (and their auth.users)
 *   - cities / schema / RLS
 *
 * REMOVES
 *   - All other profiles, venues, artworks
 *   - matches, proposals, busy periods, scans, interests, social
 *   - purchases, ledger_entries, account_balances (worksSold → 0)
 *   - matching auth.users / identities (except kept accounts)
 *   - NOT storage files (Supabase blocks SQL deletes) — empty bucket in Dashboard
 *
 * SAFETY
 *   - Aborts if no Old Library venue is found
 *   - Aborts if no admin profile is found
 *   - Does not drop tables
 *
 * Run PREVIEW_PILOT_WIPE.sql first, then paste this into Supabase SQL Editor.
 */

begin;

do $$
declare
  keep_venue_ids uuid[];
  keep_owner_ids uuid[];
  keep_admin_ids uuid[];
  keep_profile_ids uuid[];
  v_count integer;
  a_count integer;
begin
  select coalesce(array_agg(id), array[]::uuid[])
  into keep_admin_ids
  from public.profiles
  where user_type = 'admin';

  a_count := coalesce(array_length(keep_admin_ids, 1), 0);
  if a_count = 0 then
    raise exception 'Abort: no admin profile found (user_type = admin). Create/keep an admin before wiping.';
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into keep_venue_ids
  from public.venues
  where name ilike '%old library%';

  v_count := coalesce(array_length(keep_venue_ids, 1), 0);
  if v_count = 0 then
    raise exception 'Abort: no venue matching %%Old Library%%. Rename the example venue or adjust this script.';
  end if;

  select coalesce(array_agg(distinct owner_id), array[]::uuid[])
  into keep_owner_ids
  from public.venues
  where id = any (keep_venue_ids)
    and owner_id is not null;

  keep_profile_ids := (
    select coalesce(array_agg(distinct x), array[]::uuid[])
    from unnest(keep_admin_ids || keep_owner_ids) as x
  );

  raise notice 'Keeping % admin profile(s), % Old Library venue(s), % owner profile(s)',
    a_count, v_count, coalesce(array_length(keep_owner_ids, 1), 0);

  /* --- commerce / history first --- */
  if to_regclass('public.ledger_entries') is not null then
    delete from public.ledger_entries;
  end if;

  if to_regclass('public.account_balances') is not null then
    delete from public.account_balances;
  end if;

  if to_regclass('public.purchases') is not null then
    update public.purchases set winning_purchase_id = null where winning_purchase_id is not null;
    delete from public.purchases;
  end if;

  /* --- rotations / social --- */
  if to_regclass('public.qr_scans') is not null then
    delete from public.qr_scans;
  end if;

  if to_regclass('public.placement_proposals') is not null then
    delete from public.placement_proposals;
  end if;

  if to_regclass('public.venue_busy_periods') is not null then
    delete from public.venue_busy_periods
    where venue_id is null
       or venue_id <> all (keep_venue_ids);
  end if;

  if to_regclass('public.artist_venue_interests') is not null then
    delete from public.artist_venue_interests;
  end if;

  if to_regclass('public.social_interactions') is not null then
    delete from public.social_interactions;
  end if;

  if to_regclass('public.matches') is not null then
    delete from public.matches;
  end if;

  /* --- catalogue --- */
  delete from public.artworks;

  delete from public.venues
  where id <> all (keep_venue_ids);

  /* Reactivate kept example venue */
  update public.venues
  set is_active = true,
      updated_at = now()
  where id = any (keep_venue_ids);

  delete from public.profiles
  where id <> all (keep_profile_ids);

  /* Ensure kept admins stay active + admin */
  update public.profiles
  set is_active = true,
      user_type = 'admin',
      updated_at = now()
  where id = any (keep_admin_ids);

  update public.profiles
  set is_active = true,
      updated_at = now()
  where id = any (keep_owner_ids);

  /* Storage: direct DELETE on storage.objects is blocked by Supabase.
   * Clear the artworks bucket in Dashboard → Storage → artworks
   * (or empty via the Storage API with the service role). */

  /* --- auth users except kept profiles --- */
  delete from auth.identities
  where user_id <> all (keep_profile_ids);

  delete from auth.users
  where id <> all (keep_profile_ids);
end $$;

commit;

/* Verification */
select 'remaining_admins' as what, count(*)::text as n
from public.profiles where user_type = 'admin'
union all
select 'remaining_venues', count(*)::text from public.venues
union all
select 'old_library_venues', count(*)::text from public.venues where name ilike '%old library%'
union all
select 'remaining_profiles', count(*)::text from public.profiles
union all
select 'remaining_artworks', count(*)::text from public.artworks
union all
select 'remaining_purchases', count(*)::text from public.purchases
union all
select 'remaining_ledger', count(*)::text from public.ledger_entries
union all
select 'remaining_balances', count(*)::text from public.account_balances
union all
select 'remaining_matches', count(*)::text from public.matches
union all
select 'auth_users', count(*)::text from auth.users;
