/*
 * Art Hawks — wipe TEST catalogue created by SEED_TEST_CATALOGUE.sql
 *
 * Paste into Supabase → SQL Editor → Run.
 * Deletes only rows in the e0000000-… namespace / ah_test_* usernames.
 * Does not touch real pilot artists, venues, or the old Phase-1 seed IDs.
 */

/* Child rows first (social / interests if present) */
delete from public.social_interactions
where artwork_id::text like 'e0000000-bbbb-%'
   or user_id::text like 'e0000000-%';

delete from public.matches
where id::text like 'e0000000-dddd-%'
   or artwork_id::text like 'e0000000-bbbb-%'
   or venue_id::text like 'e0000000-cccc-%';

/* Optional rotation tables — ignore if missing */
do $$
begin
  if to_regclass('public.placement_proposals') is not null then
    execute $q$
      delete from public.placement_proposals
      where artwork_id::text like 'e0000000-bbbb-%'
         or from_profile_id::text like 'e0000000-%'
         or to_profile_id::text like 'e0000000-%'
         or match_id::text like 'e0000000-dddd-%'
    $q$;
  end if;
  if to_regclass('public.qr_scans') is not null then
    execute $q$
      delete from public.qr_scans
      where artwork_id::text like 'e0000000-bbbb-%'
    $q$;
  end if;
  if to_regclass('public.artist_venue_interests') is not null then
    execute $q$
      delete from public.artist_venue_interests
      where artist_id::text like 'e0000000-aaaa-%'
         or venue_id::text like 'e0000000-cccc-%'
    $q$;
  end if;
end $$;

delete from public.artworks
where id::text like 'e0000000-bbbb-%'
   or artist_id::text like 'e0000000-aaaa-%';

delete from public.venues
where id::text like 'e0000000-cccc-%'
   or slug like 'ah_test_%';

delete from public.profiles
where id::text like 'e0000000-%'
   or username like 'ah_test_%';

/* Auth stubs (after profiles — profiles FK to auth.users) */
delete from auth.identities
where user_id::text like 'e0000000-%'
   or provider_id like 'e0000000-%';

delete from auth.users
where id::text like 'e0000000-%'
   or email like 'ah_test_%@arthawks.test';

select
  (select count(*) from public.artworks where id::text like 'e0000000-%') as leftover_artworks,
  (select count(*) from public.profiles where username like 'ah_test_%') as leftover_profiles,
  (select count(*) from public.venues where slug like 'ah_test_%') as leftover_venues,
  (select count(*) from auth.users where email like 'ah_test_%@arthawks.test') as leftover_auth_users;
