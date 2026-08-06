/*
 * Real-user foundation: admin role, cities, venues entity, profile flags.
 * Venue rows backfill with id = profiles.id so match/room URLs stay stable.
 */

/* ===== admin on user_type ===== */
do $$ begin
  alter type public.user_type add value if not exists 'admin';
exception
  when duplicate_object then null;
  when others then
    /* Older Postgres: add value without IF NOT EXISTS */
    begin
      alter type public.user_type add value 'admin';
    exception when duplicate_object then null;
    end;
end $$;

/* ===== cities ===== */
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

/* ===== profile extras for auth ===== */
alter table public.profiles
  add column if not exists city_id uuid references public.cities (id) on delete set null,
  add column if not exists is_active boolean not null default true,
  add column if not exists email text;

update public.profiles
set city_id = 'd0000000-0000-4000-8000-000000000001'
where city_id is null;

/* ===== venues entity (id matches venue profile for seed backfill) ===== */
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

/*
 * Backfill: one venue row per venue profile, preserving the same UUID
 * so /rooms/{id} and matches.venue_id keep working.
 *
 * Clear slug collisions first (re-runs / partial applies can leave a venue
 * with slug=the_gallimaufry under a different id than the profile).
 */
delete from public.venues v
using public.profiles p
where p.user_type = 'venue'
  and p.username = v.slug
  and v.id <> p.id;

insert into public.venues (
  id,
  owner_id,
  city_id,
  name,
  slug,
  bio,
  website,
  instagram,
  image_url,
  geographic_location,
  district,
  footfall,
  aesthetic_tags,
  preferred_media,
  is_active
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
  slug = excluded.slug,
  name = excluded.name,
  bio = coalesce(excluded.bio, public.venues.bio),
  website = coalesce(excluded.website, public.venues.website),
  instagram = coalesce(excluded.instagram, public.venues.instagram),
  image_url = coalesce(excluded.image_url, public.venues.image_url),
  geographic_location = coalesce(excluded.geographic_location, public.venues.geographic_location),
  district = coalesce(excluded.district, public.venues.district),
  city_id = coalesce(excluded.city_id, public.venues.city_id),
  owner_id = excluded.owner_id,
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

/*
 * Admin auth user must be created via Dashboard or service-role script
 * (scripts/seed-admin.mjs). After createUser, upsert:
 *   profiles (id, username='admin', user_type='admin', onboarding_complete=true)
 */
