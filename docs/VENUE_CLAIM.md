# Claim your venue — runbook

Acquisition model for Bristol OSM prospects. Prospects are **not** Art Hawks partners until claimed, verified, onboarded, and activated.

**Do not import into production until you have reviewed a dry-run report.**

## Lifecycle

```
OSM import → draft (venue_prospects)
     ↓ admin publish
  unclaimed (public “Potential Art Hawks space”)
     ↓ user claim
  claim_pending
     ↓ admin approve
  venues row + partner_status=verified  (+ prospect verified/linked)
     ↓ owner opt-in (Activate Art Hawks)
  partner_status=active  (is_active=true — map / hang / match)
     ↘ inactive (hidden)
```

Organic `/onboard/venue` registration also starts at **verified** (not active).

## Migration

Apply in Supabase SQL editor (or CLI):

1. `supabase/migrations/20260805120000_lock_profile_user_type.sql` (if not already)
2. `supabase/migrations/20260805140000_venue_prospects_claims.sql`

Existing `venues` with `is_active=true` are backfilled to `partner_status=active`.

## Import (admin only)

1. Sign in as admin → **Admin → Prospects**
2. Click **Dry-run Overpass import**
3. Review the JSON report (fetched / inserted / updated / skipped / protected / invalid)
4. Only after review: **Apply import (draft only)**

API:

```http
POST /api/admin/venues/import?dry_run=1
POST /api/admin/venues/import?dry_run=0
```

Source: OpenStreetMap via Overpass (Bristol bbox). Creates **draft** rows only. Never overwrites `claim_pending` / `verified` / linked prospects beyond `last_checked_at`.

## Admin workflow

1. **Prospects** filter `draft` → edit if needed → **Publish unclaimed**
2. Reject junk → `inactive`
3. Merge duplicates via API `action=merge` with `merge_into_id`
4. **Claims** queue → verify claimant → **Approve** or **Reject**
5. Approve creates/links `venues` at `verified`; owner must **Activate Art Hawks** on `/venue`

## Claim workflow (public)

1. `/spaces` or map hollow pin → space page
2. **Claim this venue** → sign in if needed
3. Submit name, role, work email, verification info
4. Status → claim_pending; admin notified via email to venues@ (+ founder BCC) and Claims queue.

## Partner activation

On `/venue`, verified venues see **Activate Art Hawks** (requires postcode/location).  
`POST /api/venue/activate` sets `partner_status=active`.

Until active: no map partner pin, no swipe/match/hang (APIs already require `is_active`).

## Manual test steps

1. **Import** — dry-run, review report, apply, confirm drafts in Prospects
2. **Review** — open OSM source URL, edit name/address if needed
3. **Publish** — draft → unclaimed; confirm `/spaces` + map prospect pin
4. **Claim** — buyer/venue account submits claim; artist blocked
5. **Reject** — claim rejected; prospect returns to unclaimed
6. **Approve** — claim approved; claimant can open `/venue` as verified
7. **Onboard** — set postcode in settings
8. **Activate** — Activate Art Hawks → appears on partner map; can swipe

## RLS / security checks

- Anon cannot read `draft` prospects
- Claimant cannot UPDATE claim status (admin only)
- Owner cannot set `partner_status` / `owner_id` via client (trigger)
- Claimant cannot access another venue’s data (ownership unchanged until approve)
- Match/curate still require `is_active` (active partners only)

## Go / no-go checklist

- [ ] Migration applied on target DB
- [ ] Dry-run report reviewed; no prod apply without approval
- [ ] Old Library (or keepers) still `partner_status=active`
- [ ] New organic venue registers as verified, not on partner map until activate
- [ ] Unclaimed copy never says “Art Hawks venue” / “currently showing”
- [ ] Claim approve → verified → activate path works end-to-end
- [ ] Artist purchase / Stripe / ledger untouched
- [ ] Deploy + restart after code ship

## Routes

| Path | Role |
|------|------|
| `/admin/venues/prospects` | Import + curation |
| `/admin/venues/claims` | Claim queue |
| `/spaces` | Public prospect list |
| `/spaces/[id]` | Prospect detail + CTA |
| `/spaces/[id]/claim` | Claim form |
| `/api/venue/activate` | Owner opt-in |
