# Recreation Center Manager

A staff-only web application for managing university recreation center data: students (by house), sport records, and equipment inventory.

## Features

- **Students** — Search by student ID or name; add students to one of four houses
- **Sport records** — Filter by year and track; add new results linked to a student ID
- **Inventory** — List, add, and edit equipment quantities
- **Import** — Bulk upload from CSV (students, records, inventory)
- **Staff auth** — Individual logins via Supabase (invite-only)

### Houses

- Ruby Adventurers
- Citrine Warriors
- Emerald Fighters
- Sapphire Heroes

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project on the **Free** plan (no Pro subscription required)

## Supabase Free plan (recommended for this project)

This app only uses features available on Supabase **Free** (Hobby):

- Postgres database + SQL migrations
- Email/password auth (invite-only staff)
- Row Level Security (RLS)
- Publishable (anon) API key in the Next.js app

It does **not** require Pro. For a university rec center with a small staff team and moderate data, the free tier is sufficient.

### Use a dedicated free project (do not use Pro)

1. In the [Supabase dashboard](https://supabase.com/dashboard), create a **new project** and choose the **Free** plan when prompted.
2. Prefer a **new organization** for this university project if your personal org is on Pro — that way this app never counts against your Pro subscription.
3. Do **not** upgrade this project to Pro. If you see a Pro trial banner, you can dismiss it or let it expire; the project should remain on Free afterward.
4. Only use the **publishable** (anon) key in `.env.local` — never put the `service_role` secret in the Next.js app.

### Free tier limits (typical; check [pricing](https://supabase.com/pricing) for current numbers)

| Area | This app |
|------|----------|
| Database size | Small (students, records, inventory) — well under free limits |
| Auth users | A few staff accounts — far below free MAU |
| API traffic | Low internal use |

If a free project is **paused** after long inactivity, open the Supabase dashboard to restore it.

Deploy the frontend on [Vercel Hobby](https://vercel.com/pricing) (free) with the same env vars — no paid hosting required.

## Quick start (this repo)

If Supabase is already provisioned, see **[SETUP.md](SETUP.md)** for status and remaining steps.

```bash
npm install
npm run dev
```

`.env.local` should already point at the **NSBM Recreation Center** project.

## Setup

### 1. Supabase project (Free)

1. Create a **new Free-plan** project at [supabase.com](https://supabase.com) (see above).
2. In **SQL Editor**, run the migration file:
   [`supabase/migrations/20250531000000_initial_schema.sql`](supabase/migrations/20250531000000_initial_schema.sql)
3. In **Authentication → Providers**, enable Email. Disable public sign-ups under **Authentication → Settings** (invite-only).
4. In **Authentication → Users**, invite staff members by email and set passwords.
5. Copy your project URL and **publishable** (anon) key from **Project Settings → API**.

### 2. Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a staff account.

## CSV import formats

Download templates from the **Import** page, or use the samples in `public/samples/`.

### students.csv

```csv
student_id,full_name,house_name
2024001,John Doe,Ruby Adventurers
```

House names must match exactly: `Ruby Adventurers`, `Citrine Warriors`, `Emerald Fighters`, `Sapphire Heroes`.

### records.csv

```csv
student_id,track_name,value,year
2024001,Long Jump,5.42,2024
```

Students must exist before importing records. Track names must match seeded tracks (e.g. `Long Jump`, `100m Run`).

### inventory.csv

```csv
item_name,quantity
Basketballs,10
Badminton Rackets,20
```

Existing items (by name, case-insensitive) are updated; new names are inserted.

## Deploy to Vercel (free Hobby)

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com) on the **Hobby** plan (free for personal/school projects).
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy. Set **Site URL** in Supabase Auth settings to your Vercel domain.
5. Add redirect URL: `https://your-app.vercel.app/auth/callback`

## Adding sport tracks

Default tracks are seeded in the migration. To add more, insert into `sport_tracks` in Supabase SQL Editor:

```sql
INSERT INTO sport_tracks (name, unit, lower_is_better)
VALUES ('Triple Jump', 'm', false);
```

Use `lower_is_better = true` for timed events (seconds).

## Tech stack

- Next.js 16 (App Router)
- Tailwind CSS
- Supabase (Postgres, Auth, RLS)

## Desktop app (Electron online mode)

The desktop build is a native shell that opens the live app URL:
`https://nsbm-recreation-center.netlify.app`

### Prerequisites

- Node.js 20+
- macOS: Xcode Command Line Tools (for `.dmg` builds)
- Windows: NSIS tooling is bundled by `electron-builder`

### Commands

```bash
# Install dependencies
npm install

# Dev mode (run this app in another terminal first: npm run dev)
npm run electron:dev

# Create unpacked app folders
npm run electron:pack

# Create installers for current OS
npm run electron:dist

# Build Windows installer from Windows
npm run electron:dist -- --win

# Build macOS DMG from macOS
npm run electron:dist -- --mac
```

Artifacts are generated in `dist-electron/`.

### Notes

- This is an **online-mode** desktop app: internet is required.
- Data is shared across computers through Supabase, so updates sync everywhere.
- If you change your production URL later, update `DEFAULT_URL` in `electron/main.cjs`.
- App icon source: `electron/icons/icon.png` (from NSBM Green University Town logo). Rebuild installers after changing the icon.

## Project structure

```
app/
  (auth)/login/          Staff sign-in
  (protected)/           Dashboard, students, records, inventory, import
  auth/callback/         OAuth / magic link callback
lib/supabase/            Supabase clients + middleware
supabase/migrations/     Database schema + seeds
public/samples/          Example CSV files for testing import
```
