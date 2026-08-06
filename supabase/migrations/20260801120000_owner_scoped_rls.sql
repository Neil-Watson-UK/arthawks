/*
 * Owner-scoped RLS — replace prototype open policies for the secure pilot.
 * Service role bypasses RLS (server APIs). Authenticated clients own their rows.
 * Also quarantines Phase-1 seed demo artists/venues from Discover.
 */

/* ===== helpers ===== */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.user_type = 'admin'
      and coalesce(p.is_active, true)
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create or replace function public.owns_venue(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venues v
    where v.id = p_venue_id
      and v.owner_id = auth.uid()
  )
  or auth.uid() = p_venue_id;
$$;

revoke all on function public.owns_venue(uuid) from public;
grant execute on function public.owns_venue(uuid) to authenticated, service_role;

/* ===== profiles ===== */
drop policy if exists "Prototype public read profiles" on public.profiles;
drop policy if exists "Prototype public write profiles" on public.profiles;
drop policy if exists profiles_public_read_active on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;

create policy profiles_public_read_active
  on public.profiles for select
  to anon, authenticated
  using (coalesce(is_active, true) = true or id = auth.uid() or public.is_admin());

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() or public.is_admin());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_admin_delete
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

/* ===== artworks ===== */
drop policy if exists "Prototype public read artworks" on public.artworks;
drop policy if exists "Prototype public write artworks" on public.artworks;
drop policy if exists artworks_public_read on public.artworks;
drop policy if exists artworks_artist_insert on public.artworks;
drop policy if exists artworks_artist_update on public.artworks;
drop policy if exists artworks_artist_delete on public.artworks;

create policy artworks_public_read
  on public.artworks for select
  to anon, authenticated
  using (
    artist_id = auth.uid()
    or public.is_admin()
    or (
      status in ('available', 'matched', 'sold')
      and exists (
        select 1 from public.profiles p
        where p.id = artist_id
          and coalesce(p.is_active, true) = true
      )
    )
  );

create policy artworks_artist_insert
  on public.artworks for insert
  to authenticated
  with check (artist_id = auth.uid() or public.is_admin());

create policy artworks_artist_update
  on public.artworks for update
  to authenticated
  using (artist_id = auth.uid() or public.is_admin())
  with check (artist_id = auth.uid() or public.is_admin());

create policy artworks_artist_delete
  on public.artworks for delete
  to authenticated
  using (artist_id = auth.uid() or public.is_admin());

/* ===== matches ===== */
drop policy if exists "Prototype public read matches" on public.matches;
drop policy if exists "Prototype public write matches" on public.matches;
drop policy if exists matches_participant_read on public.matches;
drop policy if exists matches_venue_insert on public.matches;
drop policy if exists matches_participant_update on public.matches;
drop policy if exists matches_participant_delete on public.matches;

create policy matches_participant_read
  on public.matches for select
  to anon, authenticated
  using (
    public.is_admin()
    or venue_id = auth.uid()
    or public.owns_venue(venue_id)
    or exists (
      select 1 from public.artworks a
      where a.id = artwork_id and a.artist_id = auth.uid()
    )
    or status = 'accepted'
  );

create policy matches_venue_insert
  on public.matches for insert
  to authenticated
  with check (
    public.is_admin()
    or venue_id = auth.uid()
    or public.owns_venue(venue_id)
  );

create policy matches_participant_update
  on public.matches for update
  to authenticated
  using (
    public.is_admin()
    or venue_id = auth.uid()
    or public.owns_venue(venue_id)
    or exists (
      select 1 from public.artworks a
      where a.id = artwork_id and a.artist_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or venue_id = auth.uid()
    or public.owns_venue(venue_id)
    or exists (
      select 1 from public.artworks a
      where a.id = artwork_id and a.artist_id = auth.uid()
    )
  );

create policy matches_participant_delete
  on public.matches for delete
  to authenticated
  using (
    public.is_admin()
    or venue_id = auth.uid()
    or public.owns_venue(venue_id)
    or exists (
      select 1 from public.artworks a
      where a.id = artwork_id and a.artist_id = auth.uid()
    )
  );

/* ===== social_interactions ===== */
drop policy if exists "Prototype public read social" on public.social_interactions;
drop policy if exists "Prototype public write social" on public.social_interactions;
drop policy if exists social_public_read on public.social_interactions;
drop policy if exists social_insert_own on public.social_interactions;
drop policy if exists social_delete_own on public.social_interactions;

create policy social_public_read
  on public.social_interactions for select
  to anon, authenticated
  using (true);

create policy social_insert_own
  on public.social_interactions for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy social_delete_own
  on public.social_interactions for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

/* ===== artist_venue_interests (ensure table exists, then tighten RLS) ===== */
create table if not exists public.artist_venue_interests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid not null references public.profiles (id) on delete cascade,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint artist_venue_interests_unique unique (artist_id, venue_id, artwork_id)
);

create index if not exists artist_venue_interests_lookup_idx
  on public.artist_venue_interests (venue_id, artwork_id);

alter table public.artist_venue_interests enable row level security;

drop policy if exists "Anyone can read artist venue interests" on public.artist_venue_interests;
drop policy if exists "Artists can express interest in venues" on public.artist_venue_interests;
drop policy if exists "Artists can remove their own interest" on public.artist_venue_interests;
drop policy if exists artist_venue_interests_participant_read on public.artist_venue_interests;
drop policy if exists artist_venue_interests_artist_insert on public.artist_venue_interests;
drop policy if exists artist_venue_interests_artist_delete on public.artist_venue_interests;

create policy artist_venue_interests_participant_read
  on public.artist_venue_interests for select
  to authenticated
  using (
    public.is_admin()
    or artist_id = auth.uid()
    or venue_id = auth.uid()
    or public.owns_venue(venue_id)
  );

create policy artist_venue_interests_artist_insert
  on public.artist_venue_interests for insert
  to authenticated
  with check (artist_id = auth.uid() or public.is_admin());

create policy artist_venue_interests_artist_delete
  on public.artist_venue_interests for delete
  to authenticated
  using (artist_id = auth.uid() or public.is_admin());

/* ===== cities (skip if table not migrated yet) ===== */
do $$
begin
  if to_regclass('public.cities') is null then
    raise notice 'public.cities missing — skip cities RLS';
    return;
  end if;

  drop policy if exists "Prototype public read cities" on public.cities;
  drop policy if exists "Prototype public write cities" on public.cities;
  drop policy if exists cities_public_read on public.cities;
  drop policy if exists cities_admin_write on public.cities;

  create policy cities_public_read
    on public.cities for select
    to anon, authenticated
    using (is_active = true or public.is_admin());

  create policy cities_admin_write
    on public.cities for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
end $$;

/* ===== venues ===== */
do $$
begin
  if to_regclass('public.venues') is null then
    raise notice 'public.venues missing — skip venues RLS';
    return;
  end if;

  drop policy if exists "Prototype public read venues" on public.venues;
  drop policy if exists "Prototype public write venues" on public.venues;
  drop policy if exists venues_public_read on public.venues;
  drop policy if exists venues_owner_insert on public.venues;
  drop policy if exists venues_owner_update on public.venues;
  drop policy if exists venues_owner_delete on public.venues;

  create policy venues_public_read
    on public.venues for select
    to anon, authenticated
    using (is_active = true or owner_id = auth.uid() or public.is_admin());

  create policy venues_owner_insert
    on public.venues for insert
    to authenticated
    with check (owner_id = auth.uid() or public.is_admin());

  create policy venues_owner_update
    on public.venues for update
    to authenticated
    using (owner_id = auth.uid() or public.is_admin())
    with check (owner_id = auth.uid() or public.is_admin());

  create policy venues_owner_delete
    on public.venues for delete
    to authenticated
    using (owner_id = auth.uid() or public.is_admin());
end $$;

/* ===== venue_busy_periods ===== */
do $$
begin
  if to_regclass('public.venue_busy_periods') is null then
    raise notice 'public.venue_busy_periods missing — skip busy RLS';
    return;
  end if;

  drop policy if exists "Prototype public read busy" on public.venue_busy_periods;
  drop policy if exists "Prototype public write busy" on public.venue_busy_periods;
  drop policy if exists busy_participant_read on public.venue_busy_periods;
  drop policy if exists busy_venue_write on public.venue_busy_periods;

  create policy busy_participant_read
    on public.venue_busy_periods for select
    to authenticated
    using (
      public.is_admin()
      or venue_id = auth.uid()
      or public.owns_venue(venue_id)
    );

  create policy busy_venue_write
    on public.venue_busy_periods for all
    to authenticated
    using (public.is_admin() or venue_id = auth.uid() or public.owns_venue(venue_id))
    with check (public.is_admin() or venue_id = auth.uid() or public.owns_venue(venue_id));
end $$;

/* ===== placement_proposals ===== */
do $$
begin
  if to_regclass('public.placement_proposals') is null then
    raise notice 'public.placement_proposals missing — skip proposals RLS';
    return;
  end if;

  drop policy if exists "Prototype public read proposals" on public.placement_proposals;
  drop policy if exists "Prototype public write proposals" on public.placement_proposals;
  drop policy if exists proposals_participant_read on public.placement_proposals;
  drop policy if exists proposals_participant_insert on public.placement_proposals;
  drop policy if exists proposals_participant_update on public.placement_proposals;

  create policy proposals_participant_read
    on public.placement_proposals for select
    to authenticated
    using (
      public.is_admin()
      or from_profile_id = auth.uid()
      or to_profile_id = auth.uid()
    );

  create policy proposals_participant_insert
    on public.placement_proposals for insert
    to authenticated
    with check (from_profile_id = auth.uid() or public.is_admin());

  create policy proposals_participant_update
    on public.placement_proposals for update
    to authenticated
    using (
      public.is_admin()
      or from_profile_id = auth.uid()
      or to_profile_id = auth.uid()
    )
    with check (
      public.is_admin()
      or from_profile_id = auth.uid()
      or to_profile_id = auth.uid()
    );
end $$;

/* ===== qr_scans ===== */
do $$
begin
  if to_regclass('public.qr_scans') is null then
    raise notice 'public.qr_scans missing — skip scans RLS';
    return;
  end if;

  drop policy if exists "Prototype public read scans" on public.qr_scans;
  drop policy if exists "Prototype public write scans" on public.qr_scans;
  drop policy if exists scans_participant_read on public.qr_scans;

  create policy scans_participant_read
    on public.qr_scans for select
    to authenticated
    using (
      public.is_admin()
      or user_id = auth.uid()
      or venue_id = auth.uid()
      or public.owns_venue(venue_id)
      or exists (
        select 1 from public.artworks a
        where a.id = artwork_id and a.artist_id = auth.uid()
      )
    );
end $$;

/* ===== purchases — admin read ===== */
do $$
begin
  if to_regclass('public.purchases') is null then
    raise notice 'public.purchases missing — skip purchases admin RLS';
    return;
  end if;

  drop policy if exists purchases_admin_read on public.purchases;
  create policy purchases_admin_read on public.purchases
    for select
    to authenticated
    using (public.is_admin());
end $$;
/* ===== storage.objects artworks bucket ===== */
drop policy if exists "Public read artwork images" on storage.objects;
drop policy if exists "Prototype upload artwork images" on storage.objects;
drop policy if exists "Prototype update artwork images" on storage.objects;
drop policy if exists "Prototype delete artwork images" on storage.objects;
drop policy if exists artworks_images_public_read on storage.objects;
drop policy if exists artworks_images_owner_insert on storage.objects;
drop policy if exists artworks_images_owner_update on storage.objects;
drop policy if exists artworks_images_owner_delete on storage.objects;

create policy artworks_images_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'artworks');

create policy artworks_images_owner_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'artworks'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

create policy artworks_images_owner_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'artworks'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'artworks'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

create policy artworks_images_owner_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'artworks'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

/* ===== quarantine Phase-1 seed demo identities from public surfaces ===== */
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_active'
  ) then
    update public.profiles
    set is_active = false,
        updated_at = now()
    where id in (
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000099'
    );
  end if;

  if to_regclass('public.venues') is not null then
    update public.venues
    set is_active = false,
        updated_at = now()
    where id in (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000002'
    );
  end if;
end $$;

/* Swipe deck: prefer venues table; fall back to venue profiles if venues missing.
 * Uses only core artwork columns so older DBs without Auto Amor / style still work.
 */
drop function if exists public.get_swipeable_artworks(uuid, integer);

create or replace function public.get_swipeable_artworks(
  p_venue_id uuid,
  p_limit integer default 20
)
returns table (
  id uuid,
  artist_id uuid,
  title text,
  medium text,
  description text,
  style text,
  price integer,
  height_cm numeric,
  width_cm numeric,
  image_url text,
  status public.artwork_status,
  created_at timestamptz,
  distance_meters double precision,
  artist_username text,
  artist_full_name text,
  substrate_tier text,
  is_plug_and_play boolean
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  has_venues boolean := to_regclass('public.venues') is not null;
  has_style boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'artworks' and column_name = 'style'
  );
  has_substrate boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'artworks' and column_name = 'substrate_tier'
  );
  has_plug boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'artworks' and column_name = 'is_plug_and_play'
  );
  sql text;
begin
  sql := format(
    $q$
    select
      a.id,
      a.artist_id,
      a.title,
      a.medium,
      a.description,
      %s as style,
      a.price_pence as price,
      a.height_cm,
      a.width_cm,
      a.image_url,
      a.status,
      a.created_at,
      st_distance(v.geographic_location, ap.geographic_location) as distance_meters,
      ap.username as artist_username,
      ap.full_name as artist_full_name,
      %s as substrate_tier,
      %s as is_plug_and_play
    from public.artworks a
    inner join public.profiles ap on ap.id = a.artist_id
    inner join %s v on v.id = $1
    where a.status = 'available'
      and ap.user_type = 'artist'
      and coalesce(ap.is_active, true) = true
      and ap.geographic_location is not null
      and v.geographic_location is not null
      and not exists (
        select 1 from public.matches m
        where m.venue_id = $1 and m.artwork_id = a.id
      )
      and (
        %s
      )
    order by
      %s desc,
      st_distance(v.geographic_location, ap.geographic_location) asc
    limit greatest($2, 1)
    $q$,
    case when has_style then 'a.style::text' else 'null::text' end,
    case when has_substrate then 'coalesce(a.substrate_tier, ''custom'')' else '''custom''::text' end,
    case when has_plug then 'coalesce(a.is_plug_and_play, false)' else 'false' end,
    case when has_venues then 'public.venues' else 'public.profiles' end,
    case
      when has_venues then 'v.is_active = true'
      else 'v.user_type = ''venue'' and coalesce(v.is_active, true) = true'
    end,
    case when has_plug then 'coalesce(a.is_plug_and_play, false)' else 'false' end
  );

  return query execute sql using p_venue_id, p_limit;
end;
$$;

grant execute on function public.get_swipeable_artworks(uuid, integer) to anon, authenticated, service_role;
