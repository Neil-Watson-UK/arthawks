# Art Hawks

**Art where people already go.**

Art Hawks turns everyday rooms — cafés, bars, hotels, neighbourhood spaces — into a city-wide gallery. Original work is hung on real walls, discovered on a map, bought on the spot, and collected in person.

Venues hang local art for free and earn when a piece sells. Artists reach rooms people already visit and keep **70%**. Buyers find work on walls near them, pay securely, and pick it up from the venue.

Pilot city: **Bristol**.

## How it works

```
map → room → wall QR → buy → pickup verify → collect
```

1. **Artists** upload a catalogue, confirm hangs, and watch scans, loves, and buy asks.
2. **Venues** match work to a brief, mark it hung, print wall QRs, and host pickup when it sells.
3. **Explorers** browse the city map and public rooms, open an artwork’s door, and buy with a clear handover.

Sale while a work is showing on a wall: **70% artist · 15% venue · ~15% Art Hawks**. A 5% finder’s fee can apply for 30 days after a past hang when the work is not showing elsewhere.

## Stack

| Layer | Choice |
|-------|--------|
| App | [SvelteKit](https://kit.svelte.dev/) 5 + TypeScript, Node adapter |
| UI | Tailwind CSS 4, MapLibre |
| Data | [Supabase](https://supabase.com/) (Auth, Postgres, Storage) |
| Payments | [Stripe Checkout](https://stripe.com/) |
| Email | Nodemailer via IONOS SMTP |
| Hosting | Node on an IONOS VPS behind nginx/Caddy |

## Local setup

**Requirements:** Node 20+, a [Supabase](https://supabase.com/) project, and Stripe test keys.

```bash
git clone https://github.com/Neil-Watson-UK/arthawks.git
cd arthawks
cp .env.example .env
npm ci
```

Fill `.env` from `.env.example`. At minimum you need:

- `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `PURCHASE_CODE_PEPPER`

Apply every file in `supabase/migrations/` in timestamp order (Supabase SQL editor, or `node scripts/apply-migrations.mjs` with `DATABASE_URL` set).

Supabase Auth → URL Configuration (local):

- Site URL: `http://localhost:5173`
- Redirect: `http://localhost:5173/account/password`

Then:

```bash
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173).

Seed an admin (values from `.env`, never committed):

```bash
npm run seed:admin
```

Leave `PUBLIC_DEMO_IDENTITIES` and `PUBLIC_ALLOW_MOCK_FALLBACKS` unset or `false` unless you are testing demo personas locally.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (`build/`) |
| `npm run preview` | Preview the production build |
| `npm start` | Run `node build` (adapter-node) |
| `npm run check` | `svelte-check` |
| `npm run seed:admin` | Bootstrap the first admin user |
| `npm run test:purchase` | Purchase fulfilment smoke test |
| `npm run import:venues:fetch` | Overpass / OSM venue fetch |

## Product surface

| Area | Routes |
|------|--------|
| Public | `/` gateway, `/map`, `/rooms`, `/spaces`, `/artists`, `/art/[id]`, `/discover`, `/find` |
| Artist | `/artist`, inbox, promote, invite, scout |
| Venue | `/venue`, swipe, curate, calendar, pulse, collect, promote |
| Commerce | Stripe Checkout, `/pickup/[token]` (staff verify, no login) |
| Admin | users, venues, prospects, claims, artworks, matches, finance, copy |

## Docs

| Document | What it covers |
|----------|----------------|
| [Service overview](docs/Art-Hawks-Service-Overview.md) | Product, economics, audiences |
| [Deploy on IONOS](docs/DEPLOY_IONOS.md) | VPS, systemd, reverse proxy, Stripe webhook |
| [Auth and geography](docs/AUTH_AND_GEO.md) | RLS, postcodes, admin seed, Auth redirects |
| [Email](docs/EMAIL.md) | SMTP, role inboxes, reCAPTCHA |
| [Venue claims](docs/VENUE_CLAIM.md) | Prospect → claim → verify → activate |
| [Pilot checklist](docs/PILOT_INVITE_CHECKLIST.md) | Gate before inviting real artists and venues |

Production Stripe webhook: `https://YOUR_DOMAIN/api/purchases/webhook` (`checkout.session.completed`).
Set `ORIGIN` to the public HTTPS origin.

## Repo layout

```
src/routes/          Pages and API endpoints
src/lib/server/      Stripe, purchases, email, venues, copy
src/lib/components/  UI (gateway, onboard, pitch, scout, purchase)
supabase/migrations/ Schema, RLS, storage — apply in order
scripts/             Admin seed, migrations, deploy helpers, SQL fixes
docs/                Product and ops notes
static/              Brand assets, brochure PDF
```

## Status

Private product repo. Stripe Connect payouts from artist/venue balances are on the roadmap; today the ledger is the commercial record, and Stripe settles to the platform account.
