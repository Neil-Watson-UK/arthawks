/*
 * Postcode replaces district for scalable UK mapping.
 * district remains nullable for legacy seed data.
 */
alter table public.profiles
  add column if not exists postcode text;

alter table public.venues
  add column if not exists postcode text;

create index if not exists profiles_postcode_idx on public.profiles (postcode);
create index if not exists venues_postcode_idx on public.venues (postcode);
