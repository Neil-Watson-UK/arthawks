# Pilot invite gate — Art Hawks

Do **not** invite real artists or venues until every item below passes on the pilot domain (HTTPS).

## A. Data plane (security)

- [ ] All `supabase/migrations/*.sql` applied in order (storage + `20260801120000_owner_scoped_rls.sql`)
- [ ] Anon key cannot insert/update arbitrary `artworks` / `profiles` (spot-check in SQL Editor as anon)
- [ ] Storage upload only under `{auth.uid()}/…` when authenticated
- [ ] `PUBLIC_DEMO_IDENTITIES=false` and `PUBLIC_ALLOW_MOCK_FALLBACKS=false`
- [ ] Seed Neil Watson / Elena Voss / Gallimaufry / Spicer profiles are `is_active = false` (RLS migration)
- [ ] Discover / map / `/art/[id]` show empty or real rows — never silent mock catalogue
- [ ] Optional fill for UI testing: run `scripts/SEED_TEST_CATALOGUE.sql` (Unsplash, `ah_test_*`); wipe with `scripts/WIPE_TEST_CATALOGUE.sql` before real invites
- [ ] Before real invites: run `scripts/PREVIEW_PILOT_WIPE.sql`, then `scripts/WIPE_FOR_PILOT_INVITE.sql` (keeps admin + Old Library; clears art/purchases/ledger)
- [ ] Apply `20260804230000_one_paid_sale_per_artwork.sql` + `20260805120000_lock_profile_user_type.sql`

## B. Artist path

- [ ] Register artist → lands on `/artist` with working session
- [ ] Browser Supabase session synced (upload to Storage succeeds)
- [ ] Upload Auto Amor 24×30 and custom canvas → rows in `artworks` with correct `substrate_tier`
- [ ] Public `/artists/{username}` shows only that artist’s live works
- [ ] Artist can update profile / mark sold / delete **own** work only

## C. Venue path

- [ ] Register venue → Settings postcode → map pin
- [ ] `/venue/swipe` loads from `GET /api/match` (PostGIS), not mock district distance
- [ ] Match / hang / rotations APIs require signed-in venue or artist (no anonymous service-role writes)
- [ ] Match → artist confirm → approve → **Mark hung** → pin + room page
- [ ] Wall QR opens `https://YOUR_DOMAIN/art/{id}`

## D. Money & audit

- [ ] Stripe **test** Checkout completes
- [ ] Webhook marks purchase `paid`, posts ledger, marks artwork `sold`
- [ ] Replaying webhook does not double-credit (idempotent)
- [ ] Venue can collect with 6-digit code
- [ ] Admin → **Finance** shows purchase, shares, balances; CSV export works
- [ ] `PURCHASE_CODE_PEPPER` set; pickup codes never logged in plain text in production logs
- [ ] Documented economics: 70% artist · 15% wall venue (or 5% finder) · remainder platform; **manual payouts** against ledger

## E. Deploy

- [ ] IONOS VPS: Node 20, `adapter-node` build, systemd, HTTPS reverse proxy ([DEPLOY_IONOS.md](./DEPLOY_IONOS.md))
- [ ] Supabase Auth Site URL + redirects = production domain
- [ ] Stripe webhook endpoint = production `/api/purchases/webhook`
- [ ] `.env` not in git; `.env.example` present for collaborators

## Invite order

1. Pass **A + B** → invite artists (catalogue only).
2. Pass **C** → invite venues for hangs / QR.
3. Pass **D** in Stripe test → then consider live keys.
4. Keep Connect/payouts out of scope until ledger trust is proven.
