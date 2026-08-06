/*
 * Art Hawks — wipeable TEST catalogue (Unsplash images).
 *
 * Paste into Supabase → SQL Editor → Run.
 * Safe to re-run (upserts by fixed UUIDs).
 *
 * Wipe later with: scripts/WIPE_TEST_CATALOGUE.sql
 *
 * ID namespace (easy to spot): e0000000-****-4000-8000-…
 * Usernames: ah_test_*
 * Profile bio ends with: [ArtHawks TEST]
 *
 * Creates:
 *   stub auth.users (required FK for profiles)
 *   3 test artists (active)
 *   3 test venues (active + map pins)
 *   24 artworks (Unsplash)
 *   12 hung matches (showing on walls) + 2 pending
 */

create extension if not exists pgcrypto;

/*
 * Stub Auth users — profiles.id references auth.users(id).
 * Not meant for real login; emails are @arthawks.test.
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
    'e0000000-aaaa-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'ah_test_maya@arthawks.test',
    crypt('test-only-not-for-login', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Maya Chen (TEST)","ah_test":true}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e0000000-aaaa-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'ah_test_jon@arthawks.test',
    crypt('test-only-not-for-login', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Jon Okoro (TEST)","ah_test":true}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e0000000-aaaa-4000-8000-000000000003',
    'authenticated', 'authenticated',
    'ah_test_priya@arthawks.test',
    crypt('test-only-not-for-login', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Priya Nair (TEST)","ah_test":true}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e0000000-cccc-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'ah_test_harbour@arthawks.test',
    crypt('test-only-not-for-login', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Harbour Light Café (TEST)","ah_test":true}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e0000000-cccc-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'ah_test_nook@arthawks.test',
    crypt('test-only-not-for-login', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"The Quiet Nook (TEST)","ah_test":true}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e0000000-cccc-4000-8000-000000000003',
    'authenticated', 'authenticated',
    'ah_test_arcade@arthawks.test',
    crypt('test-only-not-for-login', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Arcade House (TEST)","ah_test":true}'::jsonb,
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    'e0000000-aaaa-4000-8000-000000000001',
    'e0000000-aaaa-4000-8000-000000000001',
    jsonb_build_object(
      'sub', 'e0000000-aaaa-4000-8000-000000000001',
      'email', 'ah_test_maya@arthawks.test',
      'email_verified', true
    ),
    'email',
    'e0000000-aaaa-4000-8000-000000000001',
    now(), now(), now()
  ),
  (
    'e0000000-aaaa-4000-8000-000000000002',
    'e0000000-aaaa-4000-8000-000000000002',
    jsonb_build_object(
      'sub', 'e0000000-aaaa-4000-8000-000000000002',
      'email', 'ah_test_jon@arthawks.test',
      'email_verified', true
    ),
    'email',
    'e0000000-aaaa-4000-8000-000000000002',
    now(), now(), now()
  ),
  (
    'e0000000-aaaa-4000-8000-000000000003',
    'e0000000-aaaa-4000-8000-000000000003',
    jsonb_build_object(
      'sub', 'e0000000-aaaa-4000-8000-000000000003',
      'email', 'ah_test_priya@arthawks.test',
      'email_verified', true
    ),
    'email',
    'e0000000-aaaa-4000-8000-000000000003',
    now(), now(), now()
  ),
  (
    'e0000000-cccc-4000-8000-000000000001',
    'e0000000-cccc-4000-8000-000000000001',
    jsonb_build_object(
      'sub', 'e0000000-cccc-4000-8000-000000000001',
      'email', 'ah_test_harbour@arthawks.test',
      'email_verified', true
    ),
    'email',
    'e0000000-cccc-4000-8000-000000000001',
    now(), now(), now()
  ),
  (
    'e0000000-cccc-4000-8000-000000000002',
    'e0000000-cccc-4000-8000-000000000002',
    jsonb_build_object(
      'sub', 'e0000000-cccc-4000-8000-000000000002',
      'email', 'ah_test_nook@arthawks.test',
      'email_verified', true
    ),
    'email',
    'e0000000-cccc-4000-8000-000000000002',
    now(), now(), now()
  ),
  (
    'e0000000-cccc-4000-8000-000000000003',
    'e0000000-cccc-4000-8000-000000000003',
    jsonb_build_object(
      'sub', 'e0000000-cccc-4000-8000-000000000003',
      'email', 'ah_test_arcade@arthawks.test',
      'email_verified', true
    ),
    'email',
    'e0000000-cccc-4000-8000-000000000003',
    now(), now(), now()
  )
on conflict do nothing;

/* —— Artists —— */
insert into public.profiles (
  id, username, full_name, bio, user_type, geographic_location, is_active, onboarding_complete
)
values
  (
    'e0000000-aaaa-4000-8000-000000000001',
    'ah_test_maya',
    'Maya Chen (TEST)',
    'Pilot test artist — colour fields and harbour light. [ArtHawks TEST]',
    'artist',
    st_setsrid(st_makepoint(-2.5918, 51.4642), 4326)::geography,
    true,
    true
  ),
  (
    'e0000000-aaaa-4000-8000-000000000002',
    'ah_test_jon',
    'Jon Okoro (TEST)',
    'Pilot test artist — figurative street scenes. [ArtHawks TEST]',
    'artist',
    st_setsrid(st_makepoint(-2.5776, 51.4681), 4326)::geography,
    true,
    true
  ),
  (
    'e0000000-aaaa-4000-8000-000000000003',
    'ah_test_priya',
    'Priya Nair (TEST)',
    'Pilot test artist — graphic prints and portrait studies. [ArtHawks TEST]',
    'artist',
    st_setsrid(st_makepoint(-2.6181, 51.4554), 4326)::geography,
    true,
    true
  )
on conflict (id) do update
set
  username = excluded.username,
  full_name = excluded.full_name,
  bio = excluded.bio,
  user_type = excluded.user_type,
  geographic_location = excluded.geographic_location,
  is_active = true,
  onboarding_complete = true,
  updated_at = now();

/* —— Venue profiles —— */
insert into public.profiles (
  id, username, full_name, bio, user_type, geographic_location, is_active, onboarding_complete
)
values
  (
    'e0000000-cccc-4000-8000-000000000001',
    'ah_test_harbour',
    'Harbour Light Café (TEST)',
    'Test café on the water — wipeable demoware. [ArtHawks TEST]',
    'venue',
    st_setsrid(st_makepoint(-2.5985, 51.4492), 4326)::geography,
    true,
    true
  ),
  (
    'e0000000-cccc-4000-8000-000000000002',
    'ah_test_nook',
    'The Quiet Nook (TEST)',
    'Test reading room with soft walls. [ArtHawks TEST]',
    'venue',
    st_setsrid(st_makepoint(-2.6050, 51.4575), 4326)::geography,
    true,
    true
  ),
  (
    'e0000000-cccc-4000-8000-000000000003',
    'ah_test_arcade',
    'Arcade House (TEST)',
    'Test wine bar under the arches. [ArtHawks TEST]',
    'venue',
    st_setsrid(st_makepoint(-2.5902, 51.4548), 4326)::geography,
    true,
    true
  )
on conflict (id) do update
set
  username = excluded.username,
  full_name = excluded.full_name,
  bio = excluded.bio,
  user_type = excluded.user_type,
  geographic_location = excluded.geographic_location,
  is_active = true,
  onboarding_complete = true,
  updated_at = now();

/* —— venues entity (map pins) —— */
insert into public.venues (
  id, owner_id, city_id, name, slug, bio, geographic_location, opening_hours, is_active
)
values
  (
    'e0000000-cccc-4000-8000-000000000001',
    'e0000000-cccc-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'Harbour Light Café (TEST)',
    'ah_test_harbour',
    'Test café on the water — wipeable demoware. [ArtHawks TEST]',
    st_setsrid(st_makepoint(-2.5985, 51.4492), 4326)::geography,
    'Tue–Sun 8am–5pm',
    true
  ),
  (
    'e0000000-cccc-4000-8000-000000000002',
    'e0000000-cccc-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000001',
    'The Quiet Nook (TEST)',
    'ah_test_nook',
    'Test reading room with soft walls. [ArtHawks TEST]',
    st_setsrid(st_makepoint(-2.6050, 51.4575), 4326)::geography,
    'Wed–Sat 10am–8pm',
    true
  ),
  (
    'e0000000-cccc-4000-8000-000000000003',
    'e0000000-cccc-4000-8000-000000000003',
    'd0000000-0000-4000-8000-000000000001',
    'Arcade House (TEST)',
    'ah_test_arcade',
    'Test wine bar under the arches. [ArtHawks TEST]',
    st_setsrid(st_makepoint(-2.5902, 51.4548), 4326)::geography,
    'Thu–Sun 4pm–11pm',
    true
  )
on conflict (id) do update
set
  owner_id = excluded.owner_id,
  name = excluded.name,
  slug = excluded.slug,
  bio = excluded.bio,
  geographic_location = excluded.geographic_location,
  opening_hours = excluded.opening_hours,
  is_active = true,
  updated_at = now();

/* —— 24 Unsplash works —— */
insert into public.artworks (
  id, artist_id, title, medium, description, style, price_pence,
  height_cm, width_cm, image_url, status, substrate_tier, created_at
)
values
  ('e0000000-bbbb-4000-8000-000000000001', 'e0000000-aaaa-4000-8000-000000000001',
   'Harbour Fog No. 1', 'Acrylic on canvas',
   'TEST: Soft greys over the cut. Wipe with WIPE_TEST_CATALOGUE.sql.',
   'landscape', 62000, 60, 80,
   'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=900&q=80',
   'matched', 'custom', now() - interval '20 days'),
  ('e0000000-bbbb-4000-8000-000000000002', 'e0000000-aaaa-4000-8000-000000000001',
   'Tide Line Ochre', 'Oil on linen',
   'TEST: Warm band where the mudflat meets sky.',
   'landscape', 78000, 50, 70,
   'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=900&q=80',
   'matched', 'custom', now() - interval '19 days'),
  ('e0000000-bbbb-4000-8000-000000000003', 'e0000000-aaaa-4000-8000-000000000001',
   'Blue Field Study', 'Acrylic',
   'TEST: Flat colour field for a quiet wall.',
   'abstract', 45000, 24, 30,
   'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80',
   'matched', 'auto_amor_24x30', now() - interval '18 days'),
  ('e0000000-bbbb-4000-8000-000000000004', 'e0000000-aaaa-4000-8000-000000000001',
   'Rain on Glass', 'Mixed media',
   'TEST: Vertical streaks — city weather.',
   'abstract', 52000, 70, 50,
   'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=900&q=80',
   'matched', 'custom', now() - interval '17 days'),
  ('e0000000-bbbb-4000-8000-000000000005', 'e0000000-aaaa-4000-8000-000000000001',
   'Evening Quay', 'Oil on board',
   'TEST: Last light on the pontoons.',
   'landscape', 89000, 45, 60,
   'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=900&q=80',
   'available', 'custom', now() - interval '16 days'),
  ('e0000000-bbbb-4000-8000-000000000006', 'e0000000-aaaa-4000-8000-000000000001',
   'Soft Geometry', 'Acrylic',
   'TEST: Overlapping shapes, gallery-calm.',
   'abstract', 41000, 24, 30,
   'https://images.unsplash.com/photo-1557672172-298e090bd0f1?auto=format&fit=crop&w=900&q=80',
   'available', 'auto_amor_24x30', now() - interval '15 days'),
  ('e0000000-bbbb-4000-8000-000000000007', 'e0000000-aaaa-4000-8000-000000000001',
   'Copper Horizon', 'Oil',
   'TEST: Thin copper band across a cool ground.',
   'landscape', 67000, 35, 90,
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80',
   'available', 'custom', now() - interval '14 days'),
  ('e0000000-bbbb-4000-8000-000000000008', 'e0000000-aaaa-4000-8000-000000000001',
   'Studio Still (Green)', 'Oil on canvas',
   'TEST: Quiet still life for café walls.',
   'figurative', 55000, 24, 30,
   'https://images.unsplash.com/photo-1578926375605-eaf7559b1458?auto=format&fit=crop&w=900&q=80',
   'available', 'auto_amor_24x30', now() - interval '13 days'),
  ('e0000000-bbbb-4000-8000-000000000009', 'e0000000-aaaa-4000-8000-000000000002',
   'Bus Stop Conversation', 'Oil on canvas',
   'TEST: Two figures waiting in evening light.',
   'figurative', 95000, 80, 60,
   'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=80',
   'matched', 'custom', now() - interval '12 days'),
  ('e0000000-bbbb-4000-8000-000000000010', 'e0000000-aaaa-4000-8000-000000000002',
   'Corner Shop Neon', 'Acrylic',
   'TEST: Night colour from the high street.',
   'figurative', 72000, 70, 50,
   'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?auto=format&fit=crop&w=900&q=80',
   'matched', 'custom', now() - interval '11 days'),
  ('e0000000-bbbb-4000-8000-000000000011', 'e0000000-aaaa-4000-8000-000000000002',
   'Market Day', 'Oil',
   'TEST: Crowded Saturday under a canopy.',
   'figurative', 88000, 60, 80,
   'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=900&q=80',
   'matched', 'custom', now() - interval '10 days'),
  ('e0000000-bbbb-4000-8000-000000000012', 'e0000000-aaaa-4000-8000-000000000002',
   'Alley Light', 'Oil on board',
   'TEST: Narrow cut of sun between brick.',
   'landscape', 48000, 24, 30,
   'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80',
   'matched', 'auto_amor_24x30', now() - interval '9 days'),
  ('e0000000-bbbb-4000-8000-000000000013', 'e0000000-aaaa-4000-8000-000000000002',
   'Late Tram', 'Acrylic',
   'TEST: Motion blur along the rails.',
   'graphic', 39000, 24, 30,
   'https://images.unsplash.com/photo-1561214115-f2f520621ae5?auto=format&fit=crop&w=900&q=80',
   'available', 'auto_amor_24x30', now() - interval '8 days'),
  ('e0000000-bbbb-4000-8000-000000000014', 'e0000000-aaaa-4000-8000-000000000002',
   'Park Bench Pair', 'Oil',
   'TEST: Two coats, one conversation.',
   'figurative', 61000, 55, 70,
   'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=900&q=80',
   'available', 'custom', now() - interval '7 days'),
  ('e0000000-bbbb-4000-8000-000000000015', 'e0000000-aaaa-4000-8000-000000000002',
   'Scaffold Colour', 'Mixed media',
   'TEST: Construction orange against grey sky.',
   'graphic', 43000, 60, 45,
   'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=900&q=80',
   'available', 'custom', now() - interval '6 days'),
  ('e0000000-bbbb-4000-8000-000000000016', 'e0000000-aaaa-4000-8000-000000000002',
   'Window Seat', 'Oil on canvas',
   'TEST: Café interior, looking out.',
   'figurative', 74000, 50, 65,
   'https://images.unsplash.com/photo-1577083552792-a0d461cb1dd6?auto=format&fit=crop&w=900&q=80',
   'available', 'custom', now() - interval '5 days'),
  ('e0000000-bbbb-4000-8000-000000000017', 'e0000000-aaaa-4000-8000-000000000003',
   'Bold Line Portrait', 'Screenprint',
   'TEST: Flat colour, strong contour.',
   'portrait', 36000, 24, 30,
   'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=900&q=80',
   'matched', 'auto_amor_24x30', now() - interval '4 days'),
  ('e0000000-bbbb-4000-8000-000000000018', 'e0000000-aaaa-4000-8000-000000000003',
   'Poster Study: Red', 'Ink on paper',
   'TEST: Graphic block for a bar wall.',
   'graphic', 28000, 24, 30,
   'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&w=900&q=80',
   'matched', 'auto_amor_24x30', now() - interval '3 days'),
  ('e0000000-bbbb-4000-8000-000000000019', 'e0000000-aaaa-4000-8000-000000000003',
   'Quiet Face', 'Oil on panel',
   'TEST: Soft portrait, half-turned.',
   'portrait', 82000, 45, 35,
   'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=900&q=80',
   'matched', 'custom', now() - interval '2 days'),
  ('e0000000-bbbb-4000-8000-000000000020', 'e0000000-aaaa-4000-8000-000000000003',
   'Pattern Field', 'Gouache',
   'TEST: Repeating motif, calm density.',
   'graphic', 32000, 24, 30,
   'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=900&q=80',
   'matched', 'auto_amor_24x30', now() - interval '1 day'),
  ('e0000000-bbbb-4000-8000-000000000021', 'e0000000-aaaa-4000-8000-000000000003',
   'Yellow Chair', 'Acrylic',
   'TEST: Single object study.',
   'figurative', 29000, 24, 30,
   'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?auto=format&fit=crop&w=900&q=80',
   'available', 'auto_amor_24x30', now() - interval '20 hours'),
  ('e0000000-bbbb-4000-8000-000000000022', 'e0000000-aaaa-4000-8000-000000000003',
   'Ink Wash Hill', 'Ink',
   'TEST: Loose landscape wash.',
   'landscape', 34000, 30, 50,
   'https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?auto=format&fit=crop&w=900&q=80',
   'available', 'custom', now() - interval '18 hours'),
  ('e0000000-bbbb-4000-8000-000000000023', 'e0000000-aaaa-4000-8000-000000000003',
   'Cobalt Gesture', 'Acrylic on paper',
   'TEST: Fast mark-making study.',
   'abstract', 27000, 24, 30,
   'https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?auto=format&fit=crop&w=900&q=80',
   'available', 'auto_amor_24x30', now() - interval '12 hours'),
  ('e0000000-bbbb-4000-8000-000000000024', 'e0000000-aaaa-4000-8000-000000000003',
   'Night Window', 'Oil',
   'TEST: Interior lit against dark street.',
   'portrait', 58000, 55, 45,
   'https://images.unsplash.com/photo-1482160549882-16a555766128?auto=format&fit=crop&w=900&q=80',
   'available', 'custom', now() - interval '6 hours')
on conflict (id) do update
set
  artist_id = excluded.artist_id,
  title = excluded.title,
  medium = excluded.medium,
  description = excluded.description,
  style = excluded.style,
  price_pence = excluded.price_pence,
  height_cm = excluded.height_cm,
  width_cm = excluded.width_cm,
  image_url = excluded.image_url,
  status = excluded.status,
  substrate_tier = excluded.substrate_tier;

/* —— Hung matches (showing) + pending —— */
insert into public.matches (
  id, venue_id, artwork_id, status, created_at, approved_at, hung_at, starts_on, ends_on
)
values
  ('e0000000-dddd-4000-8000-000000000001', 'e0000000-cccc-4000-8000-000000000001',
   'e0000000-bbbb-4000-8000-000000000001', 'accepted',
   now() - interval '10 days', now() - interval '9 days', now() - interval '8 days',
   current_date - 7, current_date + 60),
  ('e0000000-dddd-4000-8000-000000000002', 'e0000000-cccc-4000-8000-000000000001',
   'e0000000-bbbb-4000-8000-000000000002', 'accepted',
   now() - interval '10 days', now() - interval '9 days', now() - interval '8 days',
   current_date - 7, current_date + 60),
  ('e0000000-dddd-4000-8000-000000000003', 'e0000000-cccc-4000-8000-000000000001',
   'e0000000-bbbb-4000-8000-000000000003', 'accepted',
   now() - interval '9 days', now() - interval '8 days', now() - interval '7 days',
   current_date - 5, current_date + 45),
  ('e0000000-dddd-4000-8000-000000000004', 'e0000000-cccc-4000-8000-000000000001',
   'e0000000-bbbb-4000-8000-000000000004', 'accepted',
   now() - interval '9 days', now() - interval '8 days', now() - interval '7 days',
   current_date - 5, current_date + 45),
  ('e0000000-dddd-4000-8000-000000000005', 'e0000000-cccc-4000-8000-000000000002',
   'e0000000-bbbb-4000-8000-000000000009', 'accepted',
   now() - interval '8 days', now() - interval '7 days', now() - interval '6 days',
   current_date - 6, current_date + 50),
  ('e0000000-dddd-4000-8000-000000000006', 'e0000000-cccc-4000-8000-000000000002',
   'e0000000-bbbb-4000-8000-000000000010', 'accepted',
   now() - interval '8 days', now() - interval '7 days', now() - interval '6 days',
   current_date - 6, current_date + 50),
  ('e0000000-dddd-4000-8000-000000000007', 'e0000000-cccc-4000-8000-000000000002',
   'e0000000-bbbb-4000-8000-000000000011', 'accepted',
   now() - interval '7 days', now() - interval '6 days', now() - interval '5 days',
   current_date - 4, current_date + 40),
  ('e0000000-dddd-4000-8000-000000000008', 'e0000000-cccc-4000-8000-000000000002',
   'e0000000-bbbb-4000-8000-000000000012', 'accepted',
   now() - interval '7 days', now() - interval '6 days', now() - interval '5 days',
   current_date - 4, current_date + 40),
  ('e0000000-dddd-4000-8000-000000000009', 'e0000000-cccc-4000-8000-000000000003',
   'e0000000-bbbb-4000-8000-000000000017', 'accepted',
   now() - interval '5 days', now() - interval '4 days', now() - interval '3 days',
   current_date - 3, current_date + 55),
  ('e0000000-dddd-4000-8000-000000000010', 'e0000000-cccc-4000-8000-000000000003',
   'e0000000-bbbb-4000-8000-000000000018', 'accepted',
   now() - interval '5 days', now() - interval '4 days', now() - interval '3 days',
   current_date - 3, current_date + 55),
  ('e0000000-dddd-4000-8000-000000000011', 'e0000000-cccc-4000-8000-000000000003',
   'e0000000-bbbb-4000-8000-000000000019', 'accepted',
   now() - interval '4 days', now() - interval '3 days', now() - interval '2 days',
   current_date - 2, current_date + 35),
  ('e0000000-dddd-4000-8000-000000000012', 'e0000000-cccc-4000-8000-000000000003',
   'e0000000-bbbb-4000-8000-000000000020', 'accepted',
   now() - interval '4 days', now() - interval '3 days', now() - interval '2 days',
   current_date - 2, current_date + 35),
  ('e0000000-dddd-4000-8000-000000000013', 'e0000000-cccc-4000-8000-000000000001',
   'e0000000-bbbb-4000-8000-000000000005', 'pending',
   now() - interval '1 day', null, null, null, null),
  ('e0000000-dddd-4000-8000-000000000014', 'e0000000-cccc-4000-8000-000000000002',
   'e0000000-bbbb-4000-8000-000000000013', 'pending',
   now() - interval '1 day', null, null, null, null)
on conflict (id) do update
set
  venue_id = excluded.venue_id,
  artwork_id = excluded.artwork_id,
  status = excluded.status,
  approved_at = excluded.approved_at,
  hung_at = excluded.hung_at,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on;

select
  (select count(*) from public.artworks where id::text like 'e0000000-bbbb-%') as test_artworks,
  (select count(*) from public.matches where id::text like 'e0000000-dddd-%' and status = 'accepted') as hung_matches,
  (select count(*) from public.profiles where username like 'ah_test_%') as test_profiles;
