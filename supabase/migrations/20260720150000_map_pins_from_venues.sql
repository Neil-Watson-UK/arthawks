/*
 * Map pins from venues entity (postcode-geocoded) — not Bristol-only profiles.
 */
drop function if exists public.get_city_map_pins();

create or replace function public.get_city_map_pins()
returns table (
  venue_id uuid,
  venue_name text,
  venue_username text,
  venue_bio text,
  lat double precision,
  lng double precision,
  showing_count integer,
  transit_count integer,
  works jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with venue_rows as (
    select
      v.id,
      v.name as venue_name,
      v.slug as venue_username,
      v.bio as venue_bio,
      st_y(v.geographic_location::geometry) as lat,
      st_x(v.geographic_location::geometry) as lng
    from public.venues v
    where v.is_active = true
      and v.geographic_location is not null
  ),
  active_matches as (
    select
      m.venue_id,
      m.artwork_id,
      m.status as match_status,
      a.title,
      a.image_url,
      a.status as artwork_status,
      coalesce(ap.full_name, ap.username, 'Artist') as artist_name,
      case
        when m.status = 'accepted' or a.status = 'matched' then 'showing'
        else 'transit'
      end as placement
    from public.matches m
    join public.artworks a on a.id = m.artwork_id
    join public.profiles ap on ap.id = a.artist_id
    where m.status in ('pending', 'accepted')
      and a.status <> 'sold'
  )
  select
    v.id as venue_id,
    v.venue_name,
    v.venue_username,
    v.venue_bio,
    v.lat,
    v.lng,
    coalesce(
      (select count(*)::integer from active_matches am where am.venue_id = v.id and am.placement = 'showing'),
      0
    ) as showing_count,
    coalesce(
      (select count(*)::integer from active_matches am where am.venue_id = v.id and am.placement = 'transit'),
      0
    ) as transit_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', am.artwork_id,
            'title', am.title,
            'image_url', am.image_url,
            'artist_name', am.artist_name,
            'placement', am.placement
          )
          order by am.placement asc, am.title asc
        )
        from active_matches am
        where am.venue_id = v.id
      ),
      '[]'::jsonb
    ) as works
  from venue_rows v
  order by v.venue_name;
$$;

grant execute on function public.get_city_map_pins() to anon, authenticated;
