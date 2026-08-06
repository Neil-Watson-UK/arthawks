# Deploy Art Hawks on an IONOS VPS

The VPS runs the **SvelteKit Node app only**. Keep **Supabase Cloud** (Auth, Postgres, Storage, Realtime) and **Stripe** in the cloud.

## Prerequisites

- Ubuntu 22.04+ (or similar)
- Node **20 LTS**
- Domain DNS A/AAAA → VPS
- nginx or Caddy
- Supabase project with **all** migrations applied (including `20260801120000_owner_scoped_rls.sql` and storage)
- Stripe account (test mode first)

## 1. Build locally or on the VPS

```bash
git clone <repo> /var/www/arthawks
cd /var/www/arthawks
cp .env.example .env
# fill secrets — never commit .env
npm ci
npm run build
```

Adapter: `@sveltejs/adapter-node` → output in `build/`.

## 2. Environment

Required at runtime:

| Variable | Purpose |
|----------|---------|
| `PUBLIC_SUPABASE_URL` | Client + SSR |
| `PUBLIC_SUPABASE_ANON_KEY` | Client + SSR |
| `SUPABASE_SERVICE_ROLE_KEY` | Server APIs |
| `STRIPE_SECRET_KEY` | Checkout |
| `STRIPE_WEBHOOK_SECRET` | Webhook verify |
| `PURCHASE_CODE_PEPPER` | Pickup code hashing |
| `ORIGIN` | `https://YOUR_DOMAIN` (SvelteKit CSRF / absolute URLs) |
| `HOST` | `127.0.0.1` |
| `PORT` | `3000` |
| `NODE_ENV` | `production` |

Pilot flags:

```
PUBLIC_DEMO_IDENTITIES=false
PUBLIC_ALLOW_MOCK_FALLBACKS=false
```

## 3. systemd unit

`/etc/systemd/system/arthawks.service`:

```ini
[Unit]
Description=Art Hawks
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/arthawks
EnvironmentFile=/var/www/arthawks/.env
ExecStart=/usr/bin/node build
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now arthawks
```

## 4. Reverse proxy + HTTPS (Caddy example)

```
YOUR_DOMAIN {
  reverse_proxy 127.0.0.1:3000
}
```

nginx: proxy `https://YOUR_DOMAIN` → `http://127.0.0.1:3000`, Certbot for TLS. Pass the raw body for `/api/purchases/webhook` (default proxy_pass is fine for Stripe signature verification if you do not buffer/rewrite the body).

## 5. Supabase Auth redirects

Dashboard → Authentication → URL Configuration:

- Site URL: `https://YOUR_DOMAIN`
- Redirect: `https://YOUR_DOMAIN/account/password`

See [AUTH_AND_GEO.md](./AUTH_AND_GEO.md).

## 6. Stripe webhook

Stripe Dashboard → Webhooks → endpoint:

`https://YOUR_DOMAIN/api/purchases/webhook`

Event: `checkout.session.completed`  
Copy signing secret → `STRIPE_WEBHOOK_SECRET`.

## 7. Outbound network

VPS must reach: `*.supabase.co`, `api.stripe.com`, `api.postcodes.io`. Browsers load map tiles from `tiles.openfreemap.org`.

## 8. Smoke

See [PILOT_INVITE_CHECKLIST.md](./PILOT_INVITE_CHECKLIST.md).
