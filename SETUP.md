# Supabase setup status

Project: **NSBM Recreation Center** (`gykusyazjmfjbdwwinab`)  
Dashboard: https://supabase.com/dashboard/project/gykusyazjmfjbdwwinab

## Completed

- [x] Migration `initial_schema` applied (tables, seeds, RLS)
- [x] 4 houses seeded
- [x] 8 sport tracks seeded
- [x] `.env.local` created with project URL and publishable key
- [x] Generated types in `lib/types/supabase.ts`

## Your remaining steps (5 minutes)

### 1. Create a staff login

Supabase Dashboard → **Authentication** → **Users** → **Add user**

- Enter email + password (or send invite)
- Repeat for each staff member

### 2. Disable public sign-up (recommended)

**Authentication** → **Providers** → **Email** → ensure enabled  
**Authentication** → **URL configuration** — add:

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | Site URL (local dev) |
| `http://localhost:3000/auth/callback` | Redirect allow list |

When you deploy to Vercel, add your production URL and `https://your-app.vercel.app/auth/callback`.

### 3. Run the app

```bash
npm run dev
```

Open http://localhost:3000 and sign in with the staff user you created.

### 4. Load sample data (optional)

Use **Import** in the app with files from `public/samples/` (students first, then records, then inventory).

## Free plan

This project uses only Free-tier features. Do not upgrade to Pro unless you hit limits.
