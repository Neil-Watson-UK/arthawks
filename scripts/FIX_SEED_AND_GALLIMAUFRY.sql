/*
 * One-shot: hide Phase-1 seed catalogue / venues and collapse duplicate Gallimaufry.
 * Paste into Supabase SQL Editor if you prefer not to wait on migration runners.
 */

update public.profiles
set is_active = false,
    updated_at = now()
where id in (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000099'
);

update public.venues
set is_active = false,
    updated_at = now()
where id in (
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002'
);

update public.artworks
set status = 'sold'
where id in (
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003',
  'b0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000005'
)
and status <> 'sold';

update public.matches
set status = 'declined'
where status in ('pending', 'accepted')
  and (
    venue_id in (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000002'
    )
    or artwork_id like 'b0000000-0000-4000-8000-%'
  );

/* Keep one Gallimaufry venue — deactivate the rest */
with ranked as (
  select
    v.id,
    row_number() over (
      order by
        case when v.is_active then 0 else 1 end,
        case when p.is_active is true then 0 else 1 end,
        case when v.id = v.owner_id then 0 else 1 end,
        v.created_at desc nulls last
    ) as rn
  from public.venues v
  left join public.profiles p on p.id = v.owner_id
  where lower(v.name) = lower('The Gallimaufry')
     or v.slug in ('the_gallimaufry', 'gallimaufry')
)
update public.venues v
set is_active = (ranked.rn = 1),
    updated_at = now()
from ranked
where v.id = ranked.id;
