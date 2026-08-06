/*
 * One-shot unblock for venues_slug_unique on the_gallimaufry (and siblings).
 * Run this in Supabase SQL Editor, then re-run
 * 20260720120000_auth_cities_venues_admin.sql (or continue remaining migrations).
 */

delete from public.venues v
using public.profiles p
where p.user_type = 'venue'
  and p.username = v.slug
  and v.id <> p.id;

/* If slug still blocks and id already matches a profile, nothing to do.
 * If a rogue row has slug the_gallimaufry with no matching profile id, remove it:
 */
delete from public.venues v
where v.slug in ('the_gallimaufry', 'spicer_cole')
  and not exists (
    select 1 from public.profiles p
    where p.id = v.id and p.user_type = 'venue'
  );
