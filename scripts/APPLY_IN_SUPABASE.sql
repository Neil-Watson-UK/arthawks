/*
 * ArtHawks — paste this entire file into Supabase → SQL Editor → Run
 * Applies art styles, rotations/calendar/scans, and onboarding profile fields.
 *
 * Secure pilot: prefer supabase/migrations/ in timestamp order instead.
 * This script does NOT include storage, owner-scoped RLS
 * (20260801120000_owner_scoped_rls.sql), or purchase/ledger migrations —
 * apply those separately after this file if you still use it.
 */

/* ===== artwork style ===== */
do $$ begin
  create type public.art_style as enum (
    'landscape',
    'figurative',
    'graphic',
    'portrait',
    'abstract'
  );
exception when duplicate_object then null;
end $$;

alter table public.artworks
  add column if not exists style public.art_style;

update public.artworks set style = 'landscape' where id = 'b0000000-0000-4000-8000-000000000001' and style is null;
update public.artworks set style = 'figurative' where id = 'b0000000-0000-4000-8000-000000000002' and style is null;
update public.artworks set style = 'portrait' where id = 'b0000000-0000-4000-8000-000000000003' and style is null;
update public.artworks set style = 'graphic' where id = 'b0000000-0000-4000-8000-000000000004' and style is null;
update public.artworks set style = 'abstract' where id = 'b0000000-0000-4000-8000-000000000005' and style is null;

/* ===== rotations / busy / proposals / scans ===== */
alter table public.matches
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists install_buffer_hours integer not null default 24,
  add column if not exists wall_label text,
  add column if not exists reminder_at timestamptz,
  add column if not exists approved_at timestamptz;

do $$ begin
  create type public.proposal_type as enum ('swap', 'mood', 'size', 'hang');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.proposal_status as enum ('open', 'accepted', 'declined', 'withdrawn');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scan_source as enum ('wall_qr', 'share', 'unknown');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scan_condition as enum ('good', 'needs_attention', 'damaged');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scan_interest as enum ('browse', 'love', 'buy_ask');
exception when duplicate_object then null;
end $$;

create table if not exists public.venue_busy_periods (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint venue_busy_periods_range check (ends_on >= starts_on)
);

create table if not exists public.placement_proposals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  from_profile_id uuid not null references public.profiles (id) on delete cascade,
  to_profile_id uuid not null references public.profiles (id) on delete cascade,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  proposal_type public.proposal_type not null default 'hang',
  message text,
  requested_mood text,
  requested_min_cm numeric,
  requested_max_cm numeric,
  status public.proposal_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  match_id uuid references public.matches (id) on delete set null,
  venue_id uuid references public.profiles (id) on delete set null,
  scanned_at timestamptz not null default now(),
  source public.scan_source not null default 'wall_qr',
  condition public.scan_condition,
  interest_level public.scan_interest,
  lat numeric,
  lng numeric,
  user_id uuid references public.profiles (id) on delete set null,
  content text
);

create index if not exists venue_busy_periods_venue_idx on public.venue_busy_periods (venue_id, starts_on);
create index if not exists placement_proposals_to_idx on public.placement_proposals (to_profile_id, status);
create index if not exists placement_proposals_from_idx on public.placement_proposals (from_profile_id, status);
create index if not exists qr_scans_artwork_idx on public.qr_scans (artwork_id, scanned_at desc);
create index if not exists qr_scans_venue_idx on public.qr_scans (venue_id, scanned_at desc);

alter table public.venue_busy_periods enable row level security;
alter table public.placement_proposals enable row level security;
alter table public.qr_scans enable row level security;

drop policy if exists "Prototype public read busy" on public.venue_busy_periods;
create policy "Prototype public read busy" on public.venue_busy_periods for select using (true);
drop policy if exists "Prototype public write busy" on public.venue_busy_periods;
create policy "Prototype public write busy" on public.venue_busy_periods for all using (true) with check (true);

drop policy if exists "Prototype public read proposals" on public.placement_proposals;
create policy "Prototype public read proposals" on public.placement_proposals for select using (true);
drop policy if exists "Prototype public write proposals" on public.placement_proposals;
create policy "Prototype public write proposals" on public.placement_proposals for all using (true) with check (true);

drop policy if exists "Prototype public read scans" on public.qr_scans;
create policy "Prototype public read scans" on public.qr_scans for select using (true);
drop policy if exists "Prototype public write scans" on public.qr_scans;
create policy "Prototype public write scans" on public.qr_scans for all using (true) with check (true);

insert into public.venue_busy_periods (venue_id, starts_on, ends_on, reason)
select
  'c0000000-0000-4000-8000-000000000001'::uuid,
  date '2026-08-24',
  date '2026-08-31',
  'August bank holiday week — walls rest'
where not exists (
  select 1 from public.venue_busy_periods
  where venue_id = 'c0000000-0000-4000-8000-000000000001'
    and starts_on = date '2026-08-24'
);

/* ===== onboarding profile fields ===== */
alter table public.profiles
  add column if not exists medium text,
  add column if not exists footfall text,
  add column if not exists district text,
  add column if not exists aesthetic_tags text[] not null default '{}',
  add column if not exists preferred_media text[] not null default '{}',
  add column if not exists image_url text,
  add column if not exists onboarding_complete boolean not null default false;

update public.profiles
set
  bio = coalesce(
    nullif(bio, ''),
    'A quirky and vibrant space, The Gallimaufry invites you to unwind in a cosy atmosphere. Come in and enjoy local & carefully sourced beers, food from our kitchen pop-ups, and live music from Bristol’s best emerging artists every night of the week.'
  ),
  image_url = coalesce(
    image_url,
    'https://images.squarespace-cdn.com/content/v1/623862f6046c27587d5092b1/b9fc271b-a869-4448-b6a2-dcb61d40ff5a/DSCF8562+%281%29.jpeg'
  ),
  district = coalesce(district, 'stokes_croft'),
  footfall = coalesce(footfall, 'high'),
  onboarding_complete = true
where id = 'c0000000-0000-4000-8000-000000000001';

update public.profiles
set
  bio = coalesce(
    nullif(bio, ''),
    'We’re Spicer+Cole, four independent cafés in the heart of Bristol.

We think delicious food, along with good coffee, deserve a great place in which to be savoured. That’s why all our cafés are welcoming, light-filled spaces in lovely locations.

There’s Finzels Reach, leafy Queen Square and vibrant Clifton Village. In each café we serve the best artisan coffee and loose-leaf tea, together with super-fresh seasonal food, made from scratch in our kitchens each day.

Breakfast, lunch, coffee and cake, all made by people who care. Come and join us…'
  ),
  image_url = coalesce(
    image_url,
    'https://images.squarespace-cdn.com/content/v1/581c739fb3db2bd19dffa8b5/1489221758443-PY3JAVWPKX0WG8T9P65C/5D014586.jpg?format=2500w'
  ),
  district = coalesce(district, 'clifton'),
  footfall = coalesce(footfall, 'medium'),
  onboarding_complete = true
where id = 'c0000000-0000-4000-8000-000000000002';

/* ===== Auto Amor Project Board substrate ===== */
alter table public.artworks
  add column if not exists substrate_tier text not null default 'custom';

alter table public.artworks
  drop constraint if exists artworks_substrate_tier_check;

alter table public.artworks
  add constraint artworks_substrate_tier_check
  check (substrate_tier in ('custom', 'auto_amor_24x30'));

alter table public.artworks
  drop column if exists is_plug_and_play;

alter table public.artworks
  add column is_plug_and_play boolean
  generated always as (substrate_tier = 'auto_amor_24x30') stored;

update public.artworks
set
  substrate_tier = 'auto_amor_24x30',
  height_cm = 24,
  width_cm = 30
where id in (
  'b0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000005'
);

/* Return shape changed (style/description/Auto Amor) — must drop before recreate */
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

/* ===== Real-user foundation: admin role, cities, venues ===== */
do $$ begin
  alter type public.user_type add value if not exists 'admin';
exception
  when duplicate_object then null;
  when others then
    begin
      alter type public.user_type add value 'admin';
    exception when duplicate_object then null;
    end;
end $$;

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country_code text not null default 'GB',
  center geography(point, 4326),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.cities (id, slug, name, country_code, center, is_active)
values (
  'd0000000-0000-4000-8000-000000000001',
  'bristol',
  'Bristol',
  'GB',
  st_setsrid(st_makepoint(-2.5879, 51.4545), 4326)::geography,
  true
)
on conflict (slug) do update
set name = excluded.name,
    center = excluded.center,
    is_active = true;

alter table public.profiles
  add column if not exists city_id uuid references public.cities (id) on delete set null,
  add column if not exists is_active boolean not null default true,
  add column if not exists email text;

update public.profiles
set city_id = 'd0000000-0000-4000-8000-000000000001'
where city_id is null;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  city_id uuid references public.cities (id) on delete set null,
  name text not null,
  slug text not null,
  bio text,
  website text,
  instagram text,
  image_url text,
  geographic_location geography(point, 4326),
  district text,
  footfall text,
  aesthetic_tags text[] not null default '{}',
  preferred_media text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_slug_unique unique (slug)
);

create index if not exists venues_owner_idx on public.venues (owner_id);
create index if not exists venues_city_idx on public.venues (city_id);
create index if not exists venues_geo_idx on public.venues using gist (geographic_location);

insert into public.venues (
  id, owner_id, city_id, name, slug, bio, website, instagram, image_url,
  geographic_location, district, footfall, aesthetic_tags, preferred_media, is_active
)
select
  p.id,
  p.id,
  coalesce(p.city_id, 'd0000000-0000-4000-8000-000000000001'::uuid),
  coalesce(p.full_name, p.username),
  p.username,
  p.bio,
  p.website,
  p.instagram,
  p.image_url,
  p.geographic_location,
  p.district,
  p.footfall,
  coalesce(p.aesthetic_tags, '{}'),
  coalesce(p.preferred_media, '{}'),
  true
from public.profiles p
where p.user_type = 'venue'
on conflict (id) do update
set
  name = excluded.name,
  bio = coalesce(excluded.bio, public.venues.bio),
  website = coalesce(excluded.website, public.venues.website),
  instagram = coalesce(excluded.instagram, public.venues.instagram),
  image_url = coalesce(excluded.image_url, public.venues.image_url),
  geographic_location = coalesce(excluded.geographic_location, public.venues.geographic_location),
  district = coalesce(excluded.district, public.venues.district),
  city_id = coalesce(excluded.city_id, public.venues.city_id),
  updated_at = now();

alter table public.cities enable row level security;
alter table public.venues enable row level security;

drop policy if exists "Prototype public read cities" on public.cities;
create policy "Prototype public read cities" on public.cities for select using (true);
drop policy if exists "Prototype public write cities" on public.cities;
create policy "Prototype public write cities" on public.cities for all using (true) with check (true);

drop policy if exists "Prototype public read venues" on public.venues;
create policy "Prototype public read venues" on public.venues for select using (true);
drop policy if exists "Prototype public write venues" on public.venues;
create policy "Prototype public write venues" on public.venues for all using (true) with check (true);

/* Swipe RPC: venue entity (id-compatible with seed profiles) */
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
  inner join public.venues v on v.id = p_venue_id
  where a.status = 'available'
    and ap.user_type = 'artist'
    and v.is_active = true
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

/* ===== Postcode for scalable UK mapping ===== */
alter table public.profiles
  add column if not exists postcode text;

alter table public.venues
  add column if not exists postcode text;

create index if not exists profiles_postcode_idx on public.profiles (postcode);
create index if not exists venues_postcode_idx on public.venues (postcode);

/* ===== Map pins from venues (not Bristol-only profiles) ===== */
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
        when m.status = 'accepted'
          and m.approved_at is not null
          and (m.starts_on is null or m.starts_on <= current_date)
          and (m.ends_on is null or m.ends_on >= current_date)
        then 'showing'
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
