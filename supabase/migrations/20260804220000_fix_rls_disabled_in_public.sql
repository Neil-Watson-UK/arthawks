/*
 * Clear Supabase Security Advisor: rls_disabled_in_public
 *
 * 1) Ensure every Art Hawks app table in public has RLS on (deny-by-default
 *    until a policy allows access; service_role still bypasses).
 * 2) PostGIS spatial_ref_sys often trips this advisor but cannot have RLS
 *    enabled by the project role — revoke API roles instead.
 */

do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'artworks',
    'matches',
    'social_interactions',
    'artist_venue_interests',
    'cities',
    'venues',
    'venue_busy_periods',
    'placement_proposals',
    'qr_scans',
    'purchases',
    'account_balances',
    'ledger_entries'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

/* PostGIS system table: revoke Data API access (no user data; cannot enable RLS). */
do $$
begin
  if to_regclass('public.spatial_ref_sys') is not null then
    revoke all on table public.spatial_ref_sys from anon, authenticated;
    grant select on table public.spatial_ref_sys to postgres, service_role;
  end if;
end $$;
