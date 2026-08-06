/*
 * One paid/collected sale per artwork + atomic claim RPC.
 *
 * - Partial unique index enforces at most one paid|collected row per artwork_id.
 * - claim_purchase_sale() locks artwork, claims sold, then marks purchase paid
 *   (or needs_refund if the artwork was already sold / unique race).
 * - Does not rewrite existing paid/collected rows. Aborts if duplicates already exist.
 *
 * Pilot Checkout uses card-only (immediate settlement) in application code —
 * fulfilment requires Stripe payment_status = 'paid'.
 */

-- Fail loudly if historical duplicates would block the unique index
do $$
declare
  dup_count integer;
begin
  select count(*) into dup_count
  from (
    select artwork_id
    from public.purchases
    where status in ('paid', 'collected')
    group by artwork_id
    having count(*) > 1
  ) d;

  if dup_count > 0 then
    raise exception
      'Refusing migration: % artwork(s) already have multiple paid/collected purchases. Resolve manually before applying.',
      dup_count;
  end if;
end $$;

alter table public.purchases
  add column if not exists reconciliation_reason text,
  add column if not exists winning_purchase_id uuid references public.purchases (id) on delete set null;

comment on column public.purchases.reconciliation_reason is
  'Set when status = needs_refund (e.g. artwork_already_sold, duplicate_paid_sale, stripe_mismatch).';
comment on column public.purchases.winning_purchase_id is
  'When needs_refund, the purchase that holds the paid/collected slot for this artwork (if known).';

alter table public.purchases drop constraint if exists purchases_status_check;

alter table public.purchases
  add constraint purchases_status_check
  check (
    status in (
      'pending',
      'paid',
      'collected',
      'expired',
      'refunded',
      'needs_refund'
    )
  );

create unique index if not exists purchases_one_paid_per_artwork_idx
  on public.purchases (artwork_id)
  where status in ('paid', 'collected');

create or replace function public.claim_purchase_sale(
  p_purchase_id uuid,
  p_paid_at timestamptz,
  p_buyer_email text,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text
)
returns public.purchases
language plpgsql
security definer
set search_path = public
as $fn$
declare
  p public.purchases;
  claimed_id uuid;
  winner_id uuid;
begin
  select * into p
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'purchase_not_found' using errcode = 'P0002';
  end if;

  if p.status in ('paid', 'collected') then
    return p;
  end if;

  if p.status = 'needs_refund' then
    return p;
  end if;

  if p.status is distinct from 'pending' then
    raise exception 'purchase_not_pending:%', p.status using errcode = 'P0001';
  end if;

  /* Serialize claims for this artwork */
  perform 1
  from public.artworks
  where id = p.artwork_id
  for update;

  update public.artworks
  set
    status = 'sold',
    updated_at = now()
  where id = p.artwork_id
    and status is distinct from 'sold'
  returning id into claimed_id;

  if claimed_id is null then
    select id into winner_id
    from public.purchases
    where artwork_id = p.artwork_id
      and status in ('paid', 'collected')
    order by paid_at nulls last, created_at
    limit 1;

    update public.purchases
    set
      status = 'needs_refund',
      reconciliation_reason = 'artwork_already_sold',
      winning_purchase_id = winner_id,
      pickup_code = '------',
      pickup_code_hash = 'invalidated:' || id::text,
      code_expires_at = now() - interval '1 second',
      stripe_checkout_session_id = coalesce(p_stripe_session_id, stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
      buyer_email = coalesce(p_buyer_email, buyer_email),
      updated_at = now()
    where id = p.id
    returning * into p;

    return p;
  end if;

  begin
    update public.purchases
    set
      status = 'paid',
      paid_at = p_paid_at,
      buyer_email = coalesce(p_buyer_email, buyer_email),
      stripe_checkout_session_id = coalesce(p_stripe_session_id, stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
      updated_at = now()
    where id = p.id
      and status = 'pending'
    returning * into p;

    if not found then
      select * into p from public.purchases where id = p_purchase_id;
      return p;
    end if;
  exception
    when unique_violation then
      select id into winner_id
      from public.purchases
      where artwork_id = p.artwork_id
        and status in ('paid', 'collected')
        and id is distinct from p_purchase_id
      order by paid_at nulls last, created_at
      limit 1;

      update public.purchases
      set
        status = 'needs_refund',
        reconciliation_reason = 'duplicate_paid_sale',
        winning_purchase_id = winner_id,
        pickup_code = '------',
        pickup_code_hash = 'invalidated:' || id::text,
        code_expires_at = now() - interval '1 second',
        stripe_checkout_session_id = coalesce(p_stripe_session_id, stripe_checkout_session_id),
        stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
        buyer_email = coalesce(p_buyer_email, buyer_email),
        updated_at = now()
      where id = p_purchase_id
      returning * into p;

      return p;
  end;

  return p;
end;
$fn$;

revoke all on function public.claim_purchase_sale(uuid, timestamptz, text, text, text) from public;
grant execute on function public.claim_purchase_sale(uuid, timestamptz, text, text, text) to service_role;
