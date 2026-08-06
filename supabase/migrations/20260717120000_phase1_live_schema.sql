/*
 * ArtHawks Phase 1 — Postgres schema for Supabase SQL Editor
 *
 * How to run:
 * 1. Open Supabase Dashboard → SQL Editor → New query
 * 2. Paste this entire script and Run
 * 3. Dashboard → Database → Publications → ensure supabase_realtime
 *    includes artworks, matches, and social_interactions
 * 4. Copy Project URL + anon key into local `.env`:
 *      PUBLIC_SUPABASE_URL=...
 *      PUBLIC_SUPABASE_ANON_KEY=...
 */

create extension if not exists postgis;
create extension if not exists pgcrypto;

do $$ begin
  create type public.user_type as enum ('artist', 'venue', 'buyer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.artwork_status as enum ('available', 'matched', 'sold');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.match_status as enum ('pending', 'accepted', 'declined');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.interaction_type as enum ('like', 'comment', 'spotted_at_venue');
exception when duplicate_object then null;
end $$;

/*
 * Stub auth.users rows so profiles can FK to auth while Identity Switcher
 * operates without a real login flow.
 */
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'neil.watson@arthawks.local',
    crypt('prototype', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Neil Watson"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'elena.voss@arthawks.local',
    crypt('prototype', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Elena Voss"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'gallimaufry@arthawks.local',
    crypt('prototype', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"The Gallimaufry"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'spicer.cole@arthawks.local',
    crypt('prototype', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Spicer & Cole"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b0000000-0000-4000-8000-000000000099',
    'authenticated',
    'authenticated',
    'guest.buyer@arthawks.local',
    crypt('prototype', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Guest Buyer"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  username text not null unique,
  full_name text,
  bio text,
  user_type public.user_type not null,
  website text,
  instagram text,
  geographic_location geography(point, 4326)
);

create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  medium text,
  description text,
  price_pence integer not null check (price_pence >= 0),
  height_cm numeric,
  width_cm numeric,
  image_url text not null default '',
  status public.artwork_status not null default 'available',
  created_at timestamptz not null default now(),
  constraint artworks_description_length_check check (
    description is null or char_length(description) <= 2000
  )
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.profiles (id) on delete cascade,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  status public.match_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint matches_venue_artwork_unique unique (venue_id, artwork_id)
);

create table if not exists public.social_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  interaction_type public.interaction_type not null default 'spotted_at_venue',
  content text,
  created_at timestamptz not null default now()
);

create index if not exists artworks_artist_id_idx on public.artworks (artist_id);
create index if not exists artworks_status_idx on public.artworks (status);
create index if not exists matches_venue_id_idx on public.matches (venue_id);
create index if not exists matches_artwork_id_idx on public.matches (artwork_id);
create index if not exists social_interactions_artwork_id_idx on public.social_interactions (artwork_id);
create index if not exists profiles_geo_idx on public.profiles using gist (geographic_location);

/* Bristol seed profiles — Stokes Croft / Montpelier / Clifton */
insert into public.profiles (id, username, full_name, user_type, geographic_location)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'neil_watson',
    'Neil Watson',
    'artist',
    st_setsrid(st_makepoint(-2.5918, 51.4642), 4326)::geography
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'elena_voss',
    'Elena Voss',
    'artist',
    st_setsrid(st_makepoint(-2.5776, 51.4681), 4326)::geography
  ),
  (
    'c0000000-0000-4000-8000-000000000001',
    'the_gallimaufry',
    'The Gallimaufry',
    'venue',
    st_setsrid(st_makepoint(-2.5918, 51.4642), 4326)::geography
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'spicer_and_cole',
    'Spicer & Cole',
    'venue',
    st_setsrid(st_makepoint(-2.6181, 51.4554), 4326)::geography
  ),
  (
    'b0000000-0000-4000-8000-000000000099',
    'guest_buyer',
    'Guest Buyer',
    'buyer',
    st_setsrid(st_makepoint(-2.5979, 51.4502), 4326)::geography
  )
on conflict (id) do update
set
  username = excluded.username,
  full_name = excluded.full_name,
  user_type = excluded.user_type,
  geographic_location = excluded.geographic_location,
  updated_at = now();

insert into public.artworks (
  id, artist_id, title, medium, price_pence, height_cm, width_cm, image_url, status, created_at
)
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'Bridge of Gert Sighs',
    'Oil on canvas',
    185000,
    90,
    70,
    '/artworks/BridgeofGertSighs.JPG',
    'available',
    '2026-07-01T10:00:00Z'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'Stokes Croft',
    'Oil on canvas',
    145000,
    80,
    60,
    '/artworks/StokesCroft.jpg',
    'available',
    '2026-07-01T10:00:00Z'
  ),
  (
    'b0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000001',
    'Girl with a Pearl Earring',
    'Oil on canvas',
    220000,
    100,
    80,
    '/artworks/GirlwithPearlEarring.webp',
    'available',
    '2026-07-01T10:00:00Z'
  ),
  (
    'b0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000002',
    'Signal Collage No. 7',
    'Mixed media on board',
    98000,
    70,
    50,
    '/artworks/StokesCroft.jpg',
    'available',
    '2026-07-01T10:00:00Z'
  ),
  (
    'b0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000002',
    'Quiet Geometry',
    'Acrylic and ink on canvas',
    125000,
    85,
    65,
    '/artworks/GirlwithPearlEarring.webp',
    'available',
    '2026-07-01T10:00:00Z'
  )
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.matches enable row level security;
alter table public.social_interactions enable row level security;

/*
 * Prototype RLS — Identity Switcher uses the anon key without auth sessions.
 * Tighten these policies once real Supabase Auth replaces simulation.
 */
drop policy if exists "Prototype public read profiles" on public.profiles;
create policy "Prototype public read profiles"
  on public.profiles for select to anon, authenticated using (true);

drop policy if exists "Prototype public write profiles" on public.profiles;
create policy "Prototype public write profiles"
  on public.profiles for all to anon, authenticated using (true) with check (true);

drop policy if exists "Prototype public read artworks" on public.artworks;
create policy "Prototype public read artworks"
  on public.artworks for select to anon, authenticated using (true);

drop policy if exists "Prototype public write artworks" on public.artworks;
create policy "Prototype public write artworks"
  on public.artworks for all to anon, authenticated using (true) with check (true);

drop policy if exists "Prototype public read matches" on public.matches;
create policy "Prototype public read matches"
  on public.matches for select to anon, authenticated using (true);

drop policy if exists "Prototype public write matches" on public.matches;
create policy "Prototype public write matches"
  on public.matches for all to anon, authenticated using (true) with check (true);

drop policy if exists "Prototype public read social" on public.social_interactions;
create policy "Prototype public read social"
  on public.social_interactions for select to anon, authenticated using (true);

drop policy if exists "Prototype public write social" on public.social_interactions;
create policy "Prototype public write social"
  on public.social_interactions for all to anon, authenticated using (true) with check (true);

/*
 * Realtime publication — ignore errors if tables were already added.
 */
do $$ begin
  alter publication supabase_realtime add table public.artworks;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.social_interactions;
exception when duplicate_object then null;
end $$;

/*
 * Keep swipe RPC aligned with price_pence column naming.
 */
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
    a.price_pence as price,
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
