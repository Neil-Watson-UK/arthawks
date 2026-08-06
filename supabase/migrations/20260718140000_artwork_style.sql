/*
 * Artwork style classification for taste-aware discovery and venue curation.
 */
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
