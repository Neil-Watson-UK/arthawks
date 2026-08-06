# Auth, admin, and UK geography notes

## Apply schema (secure pilot)

Run **all** files in `supabase/migrations/` in timestamp order (or `node scripts/apply-migrations.mjs` with `DATABASE_URL`).

Critical for invite day:

1. Phase 1 schema + storage (`20260717130000_artworks_storage.sql`) — easy to miss if you only pasted `scripts/APPLY_IN_SUPABASE.sql`.
2. Auth / cities / venues / postcode / Auto Amor / rotations / purchases / ledger migrations.
3. **Owner-scoped RLS** — `20260801120000_owner_scoped_rls.sql` (replaces prototype open policies, locks Storage to `{userId}/…`, quarantines seed demo profiles).

`scripts/APPLY_IN_SUPABASE.sql` is a consolidated helper for early phases; it does **not** include storage or the owner RLS migration — prefer the migrations folder for pilot.

## Postcodes

Artist and venue registration collect a **UK postcode** (not district). Coordinates are resolved via [postcodes.io](https://postcodes.io) and stored in `geographic_location` for map/swipe distance. `district` remains nullable for older seed data.

## Seed an admin

```bash
# set in .env (never commit):
# ADMIN_EMAIL=you@example.com
# ADMIN_PASSWORD=********
npm run seed:admin
```

## Auth email redirect URLs (Supabase Dashboard → Authentication → URL Configuration)

**Local**

- Site URL: `http://localhost:5173`
- Redirect URLs:
  - `http://localhost:5173/account/password`
  - `http://localhost:5173/**`

**Production (IONOS / your domain)**

- Site URL: `https://YOUR_DOMAIN`
- Redirect URLs:
  - `https://YOUR_DOMAIN/account/password`
  - `https://YOUR_DOMAIN/**`

Forgot-password emails use `redirectTo` → `/account/password`.

## Demo Identity Switcher & mock fallbacks

Off by default. For local persona testing only:

```
PUBLIC_DEMO_IDENTITIES=true
PUBLIC_ALLOW_MOCK_FALLBACKS=true
```

In pilot/production leave both unset or `false`. Public surfaces must not invent seed artists/venues.

## Phase 3 — UK (and wider) geography

Already seeded: Bristol in `cities` (`d0000000-0000-4000-8000-000000000001`). Profiles and venues attach via `city_id`.

| Step | Work |
| --- | --- |
| Cities | Admin CRUD for cities; map/discover scoped by `?city=` or user home city |
| Real coords | Postcode/address geocode on venue save (or map pin) → `geographic_location` |
| Unify distance | Curate + swipe both use PostGIS (venue swipe uses `GET /api/match` → `get_swipeable_artworks`) |
| Rooms/map | City-scoped `get_city_map_pins(p_city_id)`; room lat/lng from venue geography |
| Copy | Remove hard-coded “Bristol · Distributed gallery” defaults |

`country_code` on `cities` already supports wider-than-UK later.
