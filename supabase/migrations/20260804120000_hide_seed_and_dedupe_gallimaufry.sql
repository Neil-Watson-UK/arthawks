/*
 * Hide Phase-1 demoware from public surfaces and collapse duplicate Gallimaufry rows.
 * Safe to re-run.
 */

/* Quarantine seed profiles / venues again */
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

/* Seed catalogue should not appear as buyable / discoverable */
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

/* Close open matches on seed venues / seed artworks */
update public.matches
set status = 'declined'
where status in ('pending', 'accepted')
  and (
    venue_id in (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000002'
    )
    or artwork_id in (
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000003',
      'b0000000-0000-4000-8000-000000000004',
      'b0000000-0000-4000-8000-000000000005'
    )
  );

/*
 * Duplicate "The Gallimaufry": keep the best live venue row, deactivate extras.
 * Prefers rows whose id matches an active venue profile owner, else newest.
 */
do $$
declare
  keeper uuid;
begin
  if to_regclass('public.venues') is null then
    return;
  end if;

  select v.id into keeper
  from public.venues v
  left join public.profiles p on p.id = v.owner_id
  where lower(v.name) = lower('The Gallimaufry')
     or v.slug in ('the_gallimaufry', 'gallimaufry')
  order by
    case when v.is_active then 0 else 1 end,
    case when p.is_active is true then 0 else 1 end,
    case when v.id = v.owner_id then 0 else 1 end,
    v.created_at desc nulls last
  limit 1;

  if keeper is null then
    return;
  end if;

  update public.venues
  set is_active = false,
      updated_at = now()
  where (lower(name) = lower('The Gallimaufry') or slug in ('the_gallimaufry', 'gallimaufry'))
    and id <> keeper;

  update public.venues
  set is_active = true,
      updated_at = now()
  where id = keeper
    and exists (
      select 1 from public.profiles p
      where p.id = public.venues.owner_id
        and p.user_type = 'venue'
        and coalesce(p.is_active, true) = true
    );
end $$;
