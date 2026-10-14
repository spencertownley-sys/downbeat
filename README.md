# Downbeat

The easiest way for a band to find time to rehearse. One person creates a
band and gets a shareable link — everyone else just taps their availability,
no account, no login, no app to download.

Built with **Next.js (App Router) · Clerk · Drizzle ORM · PostgreSQL ·
Tailwind CSS + shadcn/ui**.

## How it works

- **Band leaders** sign in with Clerk, create a band, and get a link
  like `/join/downbeat-crew-4k2p` to send to their bandmates.
- **Band members** never sign up. They open the link, type their name once,
  and land on a personal availability page at `/a/[slug]/[memberToken]` —
  that link *is* their credential, so bookmarking or re-visiting it lets
  them come back and edit anytime.
- **Getting back in on a new device** (typing the same name doesn't — names
  must be unique per band):
  - a **recovery code** shown once when they join (or made later from their
    page), entered on the invite page;
  - a **passkey** saved from their page, used via "Sign in with a passkey"
    on the invite page;
  - a **rejoin link** the band leader makes from the member list — single
    use, expires after 24 hours.
  A recovery code or rejoin link moves the member to a new personal link
  and a new code; the old ones stop working. A passkey sign-in keeps the
  current link. iPhone Safari users are prompted to add Downbeat to their
  Home Screen, since Safari erases site data after 7 days without a visit.
- Members mark a **recurring weekly grid** (Sunday–Saturday ×
  morning/afternoon/evening/night, cycling through Available → Maybe → Not
  available) plus any **specific-date exceptions** ("busy Dec 25" even
  though they're normally free Wednesdays).
- The leader's dashboard shows an **aggregate heatmap** of the whole band's
  overlap, the member roster, and everyone's upcoming one-off exceptions.

## Getting started

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Configure

Point `DATABASE_URL` in `.env.local` at a Postgres database:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/downbeat
```

For band leader sign-in, create an application at
[dashboard.clerk.com](https://dashboard.clerk.com) and set
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Which sign-in
methods leaders get (email, Google, passkeys, …) is configured in the Clerk
dashboard, not in code.

Without the Clerk keys, local dev skips sign-in and the dashboard falls back
to the first seeded profile, so you can explore immediately. A production
build without them keeps the dashboard closed instead.

**Deploying (Railway):** set both Clerk keys as service variables. The
publishable key is baked in at build time, which is why the `Dockerfile`
declares it as an `ARG`. To hand bands created before sign-in existed to your
account, also set `CLAIM_EXISTING_BANDS_FOR` to your Clerk user ID or verified
email; they move to you the next time you load the dashboard.

### 3. Migrate

```bash
npm run db:migrate
```

The Docker image runs migrations and the (idempotent) seed on every start.

### 4. Seed (optional)

```bash
npm run db:seed
```

Creates a demo leader, one band ("The Basement Tapes") with four members and
some sample availability, and prints the demo join link.

### 5. Run

```bash
npm run dev      # http://localhost:3000
npm run build && npm start   # production
npm test         # Vitest, against an in-memory Postgres (PGlite)
```

## Project layout

```
src/
├── app/
│   ├── page.tsx              # marketing landing page (public)
│   ├── (auth)/                # Clerk sign-in / sign-up — band leaders only
│   ├── join/[slug]/           # public: a member enters their name
│   ├── a/[slug]/[token]/      # public: a member's availability editor
│   ├── dashboard/              # authenticated: leader's bands
│   └── actions/                # Server Actions (bands, members, availability)
├── components/
│   ├── availability/            # WeeklyGrid, AggregateGrid, ExceptionsEditor
│   ├── marketing/                # landing page pieces
│   ├── dashboard/, join/, brand/
│   └── ui/                       # shadcn primitives
├── db/
│   ├── schema.ts                 # Drizzle schema (profiles, bands, band_members,
│   │                              # availability_weekly, availability_exceptions)
│   ├── migrations/                # generated SQL
│   ├── queries/                   # reusable read queries
│   └── seed.ts                    # demo band + members
├── lib/                            # auth (Clerk → profiles), constants, slug generator, utils
└── types/                          # shared TS types
```

## Notable implementation details

- **No login for band members.** A member's `member_token` (a random UUID)
  embedded in their personal URL is their entire authentication — every
  availability-writing Server Action re-validates that token against the
  `slug` in the URL before touching the database.
- **Weekly grid storage**: one row per `(member, day_of_week, time_block)`;
  a missing row means "not available" (the default), so most members only
  ever write a handful of rows.
- **Aggregate heatmap** is computed server-side per band by summing each
  member's weekly grid into `{available, maybe, unavailable, total}` counts
  per slot.
- **Names are unique per band** (case-insensitively). Typing a taken name
  never returns that member's link; it points to the recovery options above.
- **Recovery secrets are stored hashed**: only SHA-256 hashes of recovery
  codes and rejoin-link tokens are kept. Passkeys (WebAuthn, via
  SimpleWebAuthn) are bound to the site's domain without `www.`; set
  `WEBAUTHN_RP_ID` to pin it explicitly.
