/*
 * Extra profile fields for artist / venue onboarding and room pages.
 */
alter table public.profiles
  add column if not exists medium text,
  add column if not exists footfall text,
  add column if not exists district text,
  add column if not exists aesthetic_tags text[] not null default '{}',
  add column if not exists preferred_media text[] not null default '{}',
  add column if not exists image_url text,
  add column if not exists onboarding_complete boolean not null default false;

/* Seed known venues with richer room copy when bio is still empty */
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
