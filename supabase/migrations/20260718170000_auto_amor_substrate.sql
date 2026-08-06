/*
 * Auto Amor Project Board collaboration — substrate tiers and plug-and-play flag.
 * Official format: 24 × 30 cm boards that mate with pre-installed venue anchors.
 */

alter table public.artworks
  add column if not exists substrate_tier text not null default 'custom';

alter table public.artworks
  drop constraint if exists artworks_substrate_tier_check;

alter table public.artworks
  add constraint artworks_substrate_tier_check
  check (substrate_tier in ('custom', 'auto_amor_24x30'));

/*
 * Generated boolean — always true for official Auto Amor boards.
 * Drop + recreate so re-runs stay idempotent across Postgres versions.
 */
alter table public.artworks
  drop column if exists is_plug_and_play;

alter table public.artworks
  add column is_plug_and_play boolean
  generated always as (substrate_tier = 'auto_amor_24x30') stored;

/* Promote a couple of seed works onto the Auto Amor footprint for demoware */
update public.artworks
set
  substrate_tier = 'auto_amor_24x30',
  height_cm = 24,
  width_cm = 30
where id in (
  'b0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000005'
);

/*
 * Swipe deck: plug-and-play boards rise first, then nearest artist.
 * Return columns include substrate fields for venue badges.
 * Drop first — Postgres cannot change OUT/return row types via REPLACE.
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
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id,
    a.artist_id,
    a.title,
    a.medium,
    a.description,
    a.style::text as style,
    a.price_pence as price,
    a.height_cm,
    a.width_cm,
    a.image_url,
    a.status,
    a.created_at,
    st_distance(v.geographic_location, ap.geographic_location) as distance_meters,
    ap.username as artist_username,
    ap.full_name as artist_full_name,
    a.substrate_tier,
    a.is_plug_and_play
  from public.artworks a
  inner join public.profiles ap on ap.id = a.artist_id
  inner join public.profiles v on v.id = p_venue_id
  where a.status = 'available'
    and ap.user_type = 'artist'
    and v.user_type = 'venue'
    and ap.geographic_location is not null
    and v.geographic_location is not null
    and not exists (
      select 1
      from public.matches m
      where m.venue_id = p_venue_id
        and m.artwork_id = a.id
    )
  order by
    a.is_plug_and_play desc,
    st_distance(v.geographic_location, ap.geographic_location) asc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_swipeable_artworks(uuid, integer) to anon, authenticated;
