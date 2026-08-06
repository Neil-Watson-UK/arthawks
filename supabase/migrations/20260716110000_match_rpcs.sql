/* Artist-initiated interest in placing a specific artwork at a venue */
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

create policy "Anyone can read artist venue interests"
    on public.artist_venue_interests
    for select
    to anon, authenticated
    using (true);

create policy "Artists can express interest in venues"
    on public.artist_venue_interests
    for insert
    to authenticated
    with check (auth.uid() = artist_id);

create policy "Artists can remove their own interest"
    on public.artist_venue_interests
    for delete
    to authenticated
    using (auth.uid() = artist_id);

/* Proximity-ranked swipe deck for a venue */
create or replace function public.get_swipeable_artworks(
    p_venue_id uuid,
    p_limit integer default 20
)
returns table (
    id uuid,
    artist_id uuid,
    title text,
    medium text,
    price integer,
    height_cm numeric,
    width_cm numeric,
    image_url text,
    status public.artwork_status,
    created_at timestamptz,
    distance_meters double precision,
    artist_username text,
    artist_full_name text
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
        a.price,
        a.height_cm,
        a.width_cm,
        a.image_url,
        a.status,
        a.created_at,
        st_distance(v.geographic_location, ap.geographic_location) as distance_meters,
        ap.username as artist_username,
        ap.full_name as artist_full_name
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
    order by st_distance(v.geographic_location, ap.geographic_location) asc
    limit greatest(p_limit, 1);
$$;

grant execute on function public.get_swipeable_artworks(uuid, integer) to anon, authenticated;
