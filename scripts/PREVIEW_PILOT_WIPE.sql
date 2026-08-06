/*
 * PREVIEW — what a pilot wipe would keep / remove.
 * Single result set (Supabase SQL Editor often only shows the last query).
 * Does not delete anything.
 */

with kept as (
  select
    'admin_profile'::text as kind,
    p.id::text as id,
    p.username::text as label,
    p.user_type::text as detail,
    coalesce(p.is_active::text, '') as active
  from public.profiles p
  where p.user_type = 'admin'

  union all

  select
    'old_library_venue'::text,
    v.id::text,
    coalesce(v.name, '')::text,
    coalesce(v.slug, '')::text,
    coalesce(v.is_active::text, '')
  from public.venues v
  where v.name ilike '%old library%'

  union all

  select
    'old_library_owner'::text,
    p.id::text,
    coalesce(p.username, '')::text,
    p.user_type::text,
    coalesce(p.is_active::text, '')
  from public.venues v
  join public.profiles p on p.id = v.owner_id
  where v.name ilike '%old library%'
),
counts as (
  select * from (values
    ('count_artworks', (select count(*)::text from public.artworks), '', '', ''),
    ('count_profiles', (select count(*)::text from public.profiles), '', '', ''),
    ('count_venues', (select count(*)::text from public.venues), '', '', ''),
    ('count_purchases', (select count(*)::text from public.purchases), '', '', ''),
    ('count_paid_sales', (select count(*)::text from public.purchases where status in ('paid', 'collected')), '', '', ''),
    ('count_ledger', (select count(*)::text from public.ledger_entries), '', '', ''),
    ('count_balances', (select count(*)::text from public.account_balances), '', '', ''),
    ('count_matches', (select count(*)::text from public.matches), '', '', ''),
    (
      'total_available_pence',
      (select coalesce(sum(available_pence), 0)::text from public.account_balances),
      '',
      '',
      ''
    )
  ) as t(kind, id, label, detail, active)
),
combined as (
  select * from kept
  union all
  select * from counts
)
select *
from combined
order by kind;
