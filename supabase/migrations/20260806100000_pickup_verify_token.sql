/*
 * Public pickup verify token - QR/link for venue staff (read-only proof of payment).
 * Distinct from the 6-digit pickup_code used for authenticated collection.
 */
alter table public.purchases
  add column if not exists pickup_verify_token text;

create unique index if not exists purchases_pickup_verify_token_uidx
  on public.purchases (pickup_verify_token)
  where pickup_verify_token is not null;

comment on column public.purchases.pickup_verify_token is
  'Unpredictable public token for /pickup/{token} verify page; not the 6-digit handover code.';
