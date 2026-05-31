# Deploy to Netlify

## Current site (NSBM Recreation Center team)

- **Project:** [nsbm-recreation-center](https://app.netlify.com/projects/nsbm-recreation-center)
- **URL:** https://nsbm-recreation-center.netlify.app (live after first successful build)
- **Site ID:** `d6d8c099-ee63-404b-975b-0390da7aed76`
- **Env vars:** already configured on Netlify

### Recommended: connect GitHub (fixes local upload errors)

If `netlify deploy` fails with **“Error uploading blobs to deploy store”**, link the repo so Netlify builds in the cloud:

1. https://app.netlify.com/projects/nsbm-recreation-center/link
2. GitHub → `dacy472/NSBM-Recreation-Center` → branch `main` → Deploy

---

## One-time: connect Netlify MCP / CLI

The Netlify MCP server needs authentication on your Mac.

### Option A — CLI login (easiest)

```bash
cd ~/Projects/rec-center-manager
npx netlify login
```

Complete the browser prompt, then verify:

```bash
npx netlify status
```

Reload Cursor, then ask the agent to deploy again.

### Option B — Personal access token (if login fails)

1. [Netlify User settings → OAuth → New access token](https://app.netlify.com/user/applications#personal-access-tokens)
2. In Cursor **Settings → MCP** → edit your Netlify server and add:

```json
"env": {
  "NETLIFY_PERSONAL_ACCESS_TOKEN": "your-token-here"
}
```

3. Restart Cursor.

**Do not commit the token.**

---

## Deploy via MCP or CLI

After auth works:

```bash
cd ~/Projects/rec-center-manager
npx netlify sites:create --name nsbm-recreation-center
npx netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://gykusyazjmfjbdwwinab.supabase.co"
npx netlify env:set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "your-key-from-env-local"
npx netlify deploy --build --prod
```

Or connect GitHub in the Netlify UI: **Import** → `dacy472/NSBM-Recreation-Center` → add the same env vars → deploy.

---

## After deploy

In [Supabase Auth URL config](https://supabase.com/dashboard/project/gykusyazjmfjbdwwinab/auth/url-configuration):

- **Site URL:** `https://YOUR-SITE.netlify.app`
- **Redirect URLs:** `https://YOUR-SITE.netlify.app/auth/callback`
