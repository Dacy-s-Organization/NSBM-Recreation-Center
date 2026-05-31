# Supabase setup status

Project: **NSBM Recreation Center** (`gykusyazjmfjbdwwinab`)  
Dashboard: https://supabase.com/dashboard/project/gykusyazjmfjbdwwinab

## Completed

- [x] Migration `initial_schema` applied (tables, seeds, RLS)
- [x] 4 houses seeded
- [x] 8 sport tracks seeded
- [x] `.env.local` created with project URL and publishable key
- [x] Generated types in `lib/types/supabase.ts`

## Netlify (team: NSBM Recreation Center)

| Item | Value |
|------|--------|
| Site name | `nsbm-recreation-center` |
| URL (after first deploy) | https://nsbm-recreation-center.netlify.app |
| Dashboard | https://app.netlify.com/projects/nsbm-recreation-center |
| Env vars on Netlify | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (already set) |

### Finish deploy (one step — builds on Netlify, not your PC)

Local `netlify deploy` may fail with “Error uploading blobs” (network/VPN). Use **Git deploy** instead:

1. Open **https://app.netlify.com/projects/nsbm-recreation-center/link**
2. Choose **GitHub** → authorize → select **`dacy472/NSBM-Recreation-Center`**
3. Branch: **`main`** → Deploy site

Netlify will run `npm run build` in the cloud. First live URL: **https://nsbm-recreation-center.netlify.app**

### Supabase auth for production

After the site is live, in [Supabase Auth URL configuration](https://supabase.com/dashboard/project/gykusyazjmfjbdwwinab/auth/url-configuration):

| Setting | Value |
|---------|--------|
| Site URL | `https://nsbm-recreation-center.netlify.app` |
| Redirect URLs | `https://nsbm-recreation-center.netlify.app/auth/callback` |

Keep localhost URLs if you still develop locally.

## Your remaining steps

### 1. Create a staff login

Supabase Dashboard → **Authentication** → **Users** → **Add user**

- Enter email + password (or send invite)
- Repeat for each staff member

### 2. Disable public sign-up (recommended)

**Authentication** → **Providers** → **Email** → ensure enabled  
Turn off public sign-ups under **Authentication** → **Settings**.

### 3. Run locally (optional)

```bash
npm run dev
```

Open http://localhost:3000

### 4. Load sample data (optional)

Use **Import** in the app with files from `public/samples/` (students → records → inventory).

## Free plan

Supabase and Netlify both use **Free** tiers for this project. Do not upgrade unless you hit limits.
