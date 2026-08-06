/*
 * Public visit hours for explorers ("Go there now" on room + map).
 * Freeform text — venues write what guests need (e.g. "Tue–Sat 10–5 · Sun 11–4").
 */
alter table public.venues
  add column if not exists opening_hours text;

comment on column public.venues.opening_hours is
  'Visitor-facing open hours / visit cue, shown on public room and map sheet.';

/* Refresh map RPC so fallback path can return hours too. */
drop function if exists public.get_city_map_pins();

create or replace function public.get_city_map_pins()
returns table (
  venue_id uuid,
  venue_name text,
  venue_username text,
  venue_bio text,
  opening_hours text,
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
      v.opening_hours,
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
        when m.status = 'accepted'
          and m.approved_at is not null
          and (m.starts_on is null or m.starts_on <= current_date)
          and (m.ends_on is null or m.ends_on >= current_date)
        then 'showing'
        else 'transit'
      end as placement
    from public.matches m
    join public.artworks a on a.id = m.artwork_id
    left join public.profiles ap on ap.id = a.artist_id
    where m.status in ('pending', 'accepted')
      and a.status is distinct from 'sold'
  ),
  works_by_venue as (
    select
      am.venue_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', am.artwork_id,
            'title', am.title,
            'image_url', am.image_url,
            'artist_name', am.artist_name,
            'placement', am.placement
          )
          order by
            case when am.placement = 'showing' then 0 else 1 end,
            am.title
        ),
        '[]'::jsonb
      ) as works,
      count(*) filter (where am.placement = 'showing')::integer as showing_count,
      count(*) filter (where am.placement = 'transit')::integer as transit_count
    from active_matches am
    group by am.venue_id
  )
  select
    vr.id as venue_id,
    vr.venue_name,
    vr.venue_username,
    vr.venue_bio,
    vr.opening_hours,
    vr.lat,
    vr.lng,
    coalesce(wb.showing_count, 0) as showing_count,
    coalesce(wb.transit_count, 0) as transit_count,
    coalesce(wb.works, '[]'::jsonb) as works
  from venue_rows vr
  left join works_by_venue wb on wb.venue_id = vr.id
  order by vr.venue_name;
$$;

grant execute on function public.get_city_map_pins() to anon, authenticated;
