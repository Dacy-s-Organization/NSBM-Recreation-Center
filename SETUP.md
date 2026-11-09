# Supabase setup status

Project: **NSBM Recreation Center** (`gykusyazjmfjbdwwinab`)  
Dashboard: https://supabase.com/dashboard/project/gykusyazjmfjbdwwinab

## Completed

- [x] Migration `initial_schema` applied (tables, seeds, RLS)
- [x] 4 houses seeded
- [x] 8 sport tracks seeded
- [x] `.env.local` created with project URL and publishable key
- [x] Generated types in `lib/types/supabase.ts`

### Supabase auth URLs

In [Supabase Auth URL configuration](https://supabase.com/dashboard/project/gykusyazjmfjbdwwinab/auth/url-configuration):

| Setting | Value |
|---------|--------|
| Site URL | `http://localhost:3000` |
| Redirect URLs | `http://localhost:3000/auth/callback` |

Remove any retired Netlify address from that screen. The website is no longer hosted there.

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

Supabase uses the **Free** tier for this project. Do not upgrade unless you hit limits.
