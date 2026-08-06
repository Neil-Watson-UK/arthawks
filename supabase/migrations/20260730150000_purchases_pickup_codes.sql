/*
 * Artwork purchases + venue pickup codes (Deliveroo-style handover).
 */
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete restrict,
  match_id uuid references public.matches (id) on delete set null,
  venue_id uuid references public.venues (id) on delete set null,
  artist_id uuid not null references public.profiles (id) on delete restrict,
  buyer_user_id uuid references public.profiles (id) on delete set null,
  buyer_email text,
  amount_pence integer not null check (amount_pence > 0),
  currency text not null default 'gbp',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  pickup_code text not null,
  pickup_code_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'collected', 'expired', 'refunded')),
  code_expires_at timestamptz,
  paid_at timestamptz,
  collected_at timestamptz,
  collected_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchases_artwork_idx on public.purchases (artwork_id);
create index if not exists purchases_venue_status_idx on public.purchases (venue_id, status);
create index if not exists purchases_code_hash_idx on public.purchases (pickup_code_hash);
create index if not exists purchases_session_idx on public.purchases (stripe_checkout_session_id);

comment on table public.purchases is
  'Stripe-backed artwork sales; pickup_code proves payment at the venue.';

comment on column public.purchases.pickup_code is
  'Plain 6-digit code shown to buyer after payment; venue enters it to release the work.';

alter table public.purchases enable row level security;

/* Service role / server routes own writes; authenticated venue can read own paid/collected. */
drop policy if exists purchases_venue_read on public.purchases;
create policy purchases_venue_read on public.purchases
  for select
  to authenticated
  using (
    venue_id in (
      select v.id from public.venues v where v.owner_id = auth.uid()
    )
    or artist_id = auth.uid()
    or buyer_user_id = auth.uid()
  );
