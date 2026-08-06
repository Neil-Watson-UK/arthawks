/*
 * Artist catalogue enrichment — description + management fields.
 * Run in Supabase SQL Editor after Phase 1 schema.
 */

alter table public.artworks
  add column if not exists description text;

do $$ begin
  alter table public.artworks
    add constraint artworks_description_length_check
    check (description is null or char_length(description) <= 2000);
exception
  when duplicate_object then null;
end $$;

comment on column public.artworks.description is
  'Artist-written descriptor for the work, max 2000 characters.';
