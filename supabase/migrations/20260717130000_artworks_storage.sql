/*
 * ArtHawks Storage — run in Supabase SQL Editor after the Phase 1 schema.
 * Creates a public bucket so artist uploads become durable HTTPS URLs
 * instead of ephemeral blob: URLs that blank out the swipe deck.
 */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artworks',
  'artworks',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read artwork images" on storage.objects;
create policy "Public read artwork images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'artworks');

drop policy if exists "Prototype upload artwork images" on storage.objects;
create policy "Prototype upload artwork images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'artworks');

drop policy if exists "Prototype update artwork images" on storage.objects;
create policy "Prototype update artwork images"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'artworks')
  with check (bucket_id = 'artworks');

drop policy if exists "Prototype delete artwork images" on storage.objects;
create policy "Prototype delete artwork images"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'artworks');

/*
 * Clear any Phase-1 rows that stored dead blob: preview URLs.
 * Re-upload those works from /artist after Storage is live.
 */
update public.artworks
set image_url = ''
where image_url like 'blob:%';
