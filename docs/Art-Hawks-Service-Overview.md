# Art Hawks — Service Overview

*A living, distributed gallery for the city.*  
Document for investors, venues, and artists · August 2026

---

## 1. The idea in one line

**Art Hawks turns everyday rooms — cafés, bars, hotels, neighbourhood spaces — into a city-wide gallery where original art is discovered, loved, and bought where people already gather.**

The white cube is optional. Lunch, a drink, or a quiet corner can be the opening night.

---

## 2. The problem

| Audience | Friction today |
|----------|----------------|
| **Artists** | Work sits in portfolios and storage. Gallery access is scarce, slow, and often extractive. Online sales lack place, story, and footfall. |
| **Venues** | Walls are empty or decorative filler. Hosting art feels administrative: sourcing, hanging, insurance anxiety, no clear upside. |
| **Explorers / buyers** | Art discovery is either institutional (museums) or algorithmic (feeds). Buying from a café wall is rare, awkward, or cash-under-the-table. |

Cities already have the rooms and the people. What’s missing is the **network layer** that matches artists to walls, makes hangs trustworthy, and turns a glance into a purchase.

---

## 3. What Art Hawks is

Art Hawks is a **three-sided marketplace** wrapped in a civic product:

1. **Artists** upload catalogue, confirm hangs, see door traffic (scans, loves, buy asks).
2. **Venues** curate walls, schedule rotations, mark work hung, host pickup when a piece sells.
3. **Explorers** discover art on a city map and in public “rooms,” open an artwork’s door (via QR or link), and buy with a clear handover.

The product is not another Instagram shop. It is **place-based art infrastructure**: map → room → door → purchase → collection.

---

## 4. How the service works

### 4.1 Discovery

- A **city map** shows venues with work currently showing (confirmed hung, inside its hang window), plus hollow pins for **unclaimed spaces** that can join the network.
- Each venue has a public **room page** — living walls, works heading there, and a **past exhibits** archive (including sold pieces, marked as sold).
- **Discover** surfaces works on walls, rooms, social traces, and a daily **artist & venue of the day**.
- An **artists directory** (`/artists`) lists studios in a daily-seeded order so the network stays browsable.
- Public **artist pages** show catalogue: on walls, in transit, in studio, and sold.

### 4.2 Matching & hanging

- Venues **swipe** available local work or use **Curate for Me**.
- **Curate for Me** starts with a short **brief**: how many works (1–5), largest size the room can hang, and optional types (landscape, figurative, graphic, portrait, abstract). Suggestions respect those constraints before ranking by plug-and-play fit, style, and distance.
- Artists confirm interest (or propose swaps) in a **match inbox**.
- Venues approve a hang, schedule on a **wall calendar**, then mark **Hung on wall** — the install handshake that makes the work live on the map and room.
- **Auto Amor** boards (standard sizes) make hanging plug-and-play for partner spaces.
- QR **wall labels** open the artwork’s public door for guests.

### 4.3 Buying & collection

- From the art door, a buyer pays via **Stripe Checkout**.
- On payment they receive:
  - a **pickup verify QR / link** — staff can open it **without signing in** to confirm the piece is paid, at this venue, and still awaiting collection;
  - a **6-digit backup code** for the venue owner account.
- Confirmation also goes by **email** (buyer, and venue owner when an email is on file).
- Front-of-house can release the physical work with confidence from the verify page.
- The **venue owner** later confirms collection in **Confirm collection** (code or awaiting list) to close the handover on the ledger. Balances are credited when payment succeeds; collection records the physical release.
- Sold works remain in the story of the room and the artist — **marked sold**, not erased.

### 4.4 Spaces & venue claims

- Candidate rooms enter as **venue prospects** (OpenStreetMap import and/or manual add).
- Admins publish prospects as **unclaimed**; the public **Spaces** directory and map invite owners to claim.
- After admin approval, the venue is **verified**, then the owner **activates** Art Hawks so the room can appear on the map and enter matching.

### 4.5 Pulse & promotion

- Scans, loves, buy asks, and condition notes feed **venue pulse** and **artist wall pulse**.
- Venues and artists can generate **promotion packs** (QR codes, stories, profiles) for print and sharing.

---

## 5. For artists

### Why join

- Hang where people already spend time — not only where they go to “see art.”
- Real door traffic: who opened the work, who loved it, who asked to buy.
- Mutual match with venues (not cold-calling café managers).
- Clear economics: **70% of sale price** credited to your balance when a work sells through the platform.

### What you do

1. Register as an artist and complete your studio profile.
2. Upload works (title, medium, style, price, story, image). Optional Auto Amor sizing for easy hangs.
3. Respond to venue interest; confirm hangs.
4. Watch scans and pulse; promote doors and QR packs.
5. When a work sells, your balance updates; the buyer collects at the hosting venue.

### What you keep after a sale

Sold works stay on your public page under **Found a home** — proof that the platform moves work into lives, not just listings.

---

## 6. For venues

### Why host

- Walls become **marketing you don’t invent** — guests linger, scan, and return.
- Curated local art without running a gallery — including a **brief-first** auto-curation path so suggestions fit wall size and taste.
- Revenue when hung work sells: **15% wall fee** on sales while the piece is showing on your walls.
- Optional **5% finder’s fee** when a past hang leads to a sale (see economics below).
- Map presence: your room is a destination in the city gallery.

### What you do

1. Register as a venue (or **claim** an unclaimed space), set identity (name, postcode, bio, hours, image), then **activate** so you appear on the map.
2. Set a Curate brief (count, max size, types) or swipe; approve hangs; mark hung when installed.
3. Print wall QR labels; share your room and promotion pack.
4. Watch **scan pulse**; rotate when the calendar or pulse nudges you.
5. When a guest buys, staff can scan the buyer’s **verify QR** (no login). The owner later confirms collection in Art Hawks to close the handover.

### Past exhibits

Your room keeps a **past on these walls** archive. That history builds trust and can earn a finder’s fee when eligible — without cluttering what’s currently showing.

---

## 7. For explorers & buyers

- Browse freely — no account required to look.
- Find art by map, room, discover feed, artists directory, or scanning a wall QR.
- Open the door: story, artist, dimensions, price.
- Buy securely; receive a verify QR (and backup code) by screen and email.
- Show the QR at the venue; collect the work.
- Share a find; join the count of works sold through Art Hawks.

---

## 8. Economics (monetisation)

Art Hawks takes a transparent cut of sales completed through the platform. Balances are credited on payment (ledger). Stripe settles to the platform account; participant balances are the commercial record for artists and venues (payout rails can extend later via Connect).

### Sale while the work is **showing** on a venue wall

| Party | Share |
|-------|------:|
| Artist | **70%** |
| Venue (wall fee) | **15%** |
| Art Hawks | **~15%** |

### Sale via a **past hang** (finder path)

When a sale is attributed to a venue that previously hung the work, and the work is **not** currently showing (or accepted) at another venue:

| Party | Share |
|-------|------:|
| Artist | **70%** |
| Finder venue | **5%** |
| Art Hawks | **remainder (~25%)** |

**Finder eligibility (anti–double-pay rules):**

- Fee applies only for **30 days after** the work was marked hung (`hung_at`).
- Fee does **not** apply if the work is currently **showing** elsewhere (that venue takes the 15% wall fee instead).
- Fee does **not** apply if the work is already **accepted** at a different venue (avoids stacking wall + finder).

### Sale with no venue attribution

Artist keeps what would have been the venue share; Art Hawks takes **15%**; artist receives the rest (**~85%**).

### Social proof

The product surfaces how many works have sold through Art Hawks — reinforcing that walls lead to homes, not only to likes.

---

## 9. Product surface (what exists)

| Area | Capability |
|------|------------|
| Gateway & onboarding | Pitch pages for hosts and artists; role-based registration |
| Artist studio | Catalogue, profile, inbox, promotion pack, balances, wall pulse |
| Venue hub | Identity, swipe, curate brief, calendar, hung handshake, pulse, collect, promote, balances, activation |
| Public | City map, rooms, spaces/claims, artists directory, art doors, discover + of-the-day |
| Commerce | Stripe checkout, webhook fulfilment, pickup verify QR, backup codes, sold status, ledger splits, transactional email |
| Admin | Users, partner venues, prospects (search / A–Z / import / manual add), claims, artworks, matches, inbox, finance (GMV, ledger, CSV) |

**Stack:** SvelteKit (Node on VPS) · Supabase (auth, Postgres, storage) · Stripe Checkout · MapLibre · Nodemailer (IONOS SMTP) · Google Analytics · QR wall labels and pickup verify links.

**Pilot notes (honest):**

- Ledger credits land when payment is **paid**; collection confirms physical handover (not a second money event).
- Venue **staff** use the public verify page; there are no separate staff logins — owners confirm collection in-app.
- Stripe Connect / automated payouts from balances are on the roadmap; today balances are the commercial record.

---

## 10. Why this matters (investor lens)

1. **Real-world network effects** — More hung walls → denser map → more discovery → more sales → more artist and venue participation.
2. **Two paid sides, one buyer** — Artists get distribution; venues get culture + commission; buyers get a trustworthy path from wall to ownership.
3. **Defensible place graph** — Matches, hung handshakes, rooms, prospects, and past exhibits are operational data competitors can’t scrape from a feed.
4. **Clear unit economics** — Fixed percentage splits; wall fee vs finder’s fee designed to reward hosting without over-paying.
5. **Category creation** — Not “another marketplace”; **distributed gallery infrastructure** for cities that already have the rooms.

### Near-term product trajectory (indicative)

- Stripe Connect / payouts from balances to artists and venues  
- Stronger city seeding, prospect pipeline, and venue partnerships  
- Richer past-exhibit and “works sold” storytelling  
- Optional staff / device flows beyond the public verify page  
- Insurance / condition workflows as hang volume grows  

---

## 11. One-page summary by audience

### Artists
Hang in living rooms of the city. See who meets your work. Keep **70%** when it sells. Stay visible after the sale.

### Venues
Fill walls with matched local art that fits your brief. Go live on the map. Earn **15%** on wall sales (or **5%** finder’s fee under the 30-day rules). Staff verify paid pickups with a QR — no app login required.

### Investors
A three-sided, place-based marketplace with install truth, QR doors, Stripe commerce, low-friction handover, and transparent revenue share — turning empty walls into a measurable gallery network.

---

## 12. Contact & next step

Art Hawks is live in product form: hang → discover → buy → verify → collect → balance.

To pilot a room, open a studio, claim a space, or discuss investment and city rollout, start from the product gateway (**I host a room** / **I make the work**) or contact the Art Hawks team directly.

---

*This document describes the service as implemented and intended. Commercial terms for specific partnerships may be agreed separately; the percentage splits above are the platform’s default sale economics.*
