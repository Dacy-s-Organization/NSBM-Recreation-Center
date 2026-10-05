# NSBM Recreation Center Manager — Presentation & Discussion

**Suggested length:** 8–12 minutes speech + 5–10 minutes Q&A  
**Audience:** Staff, faculty, or technical stakeholders at NSBM Green University Town  
**Tone:** Clear, confident, practical — emphasize outcomes, not jargon

---

## Speech (read or adapt)

Good [morning/afternoon], everyone.

Today I want to walk you through **NSBM Recreation Center Manager** — a staff portal we built to run the recreation center’s day-to-day work in one place: **students**, **sporting achievements and records**, **team registration cards**, and **equipment inventory**. Everything lives in a **single shared database**, so whether someone uses the **web app** in a browser or the **Windows desktop app** on the front desk PC, they see the **same live data**.

### Why this system exists

Recreation centers deal with overlapping information: student IDs from the university, house assignments for inter-house sport, yearly athletic results, inter-university wins, gear counts, and paper or digital **team entry forms**. Before a dedicated tool, that often means spreadsheets, duplicate entry, and hard-to-answer questions like “Who holds the record for this event this year?” or “Do we already have this student in Emerald house?”

This system answers those questions **quickly**, keeps **one source of truth**, and respects **who is allowed to change what**.

### Big picture — how it fits together

At the center is **Supabase**: a PostgreSQL database with **staff authentication** and **Row Level Security**. Only invited staff can sign in; the database enforces permissions, not just the user interface.

On top of that we have:

1. **Web application** — Next.js, modern and responsive, deployable on free-tier hosting (e.g. Vercel or Netlify).
2. **Desktop application** — a native **Windows** app (WPF + Blazor) for staff who prefer a dedicated window, offline-friendly session memory, and a polished desktop experience — still connected to the **same** Supabase project.

So we are not maintaining two different datasets. We built **one backend**, **two front doors**.

### What staff do every day

**Dashboard** — At a glance: how many students we track, how many athletic records exist for the current year across achievement sections, and how many inventory lines we maintain. Quick links take you into the main areas.

**Students** — Search by student ID or name, including a **global search** from the navigation bar. Students are organized around **university reality**: faculties, intakes, and batches — not just a flat list. Each student can be assigned to one of four **houses**: Ruby, Citrine, Emerald, and Sapphire. Staff can add, edit, and review profiles, and open a detail view that can include **linked certificates** where we have stored them.

A standout operational feature is **CSV import tuned for NSBM**: we can ingest foundation-style exports with columns like Student No, Faculty, Degree Programme, and contact fields — then assign houses in the app after import. That cuts manual typing at the start of each intake.

**Achievements** — This is split into two major **sections**, each with its own data but the same workflows:

- **Sports Fiesta** — inter-house competition, with categories for other sports and athletics.
- **Inter University** — external competition focus.

Within each section, staff work in two tabs:

- **Sports achievements** — teams, champions, best players, winners tied to student IDs and houses.
- **Athletic records** — track-and-field style events with units (seconds or meters), year, gender, and rules like **one record holder per track per year per gender**, with sensible prompts when replacing an existing record.

Super staff can **manage sport tracks and events** — add or remove disciplines without touching the database by hand.

**Team Cards** — One of the most distinctive parts of the system. Staff upload **entry forms** as Word, Excel, CSV, or even **photos** of paper forms. The pipeline **parses and extracts** athlete rows (student ID, name, jersey number) and supports attaching multiple photos per card. That bridges “what arrived on paper or in email” with structured data we can trust and search — including **OCR on Windows** in the desktop stack for photographed forms.

**Inventory** — Simple but essential: item names and quantities, inline edit, add, delete, and CSV import that **updates** existing items by name or **inserts** new ones.

**Certificates** — For records and achievements we can attach **issued certificate files** under stable reference numbers, view them in context on record rows and student profiles, and keep audit-friendly storage in the database layer via dedicated RPCs — so file handling stays controlled and role-aware.

### Security and roles — worth highlighting

Authentication is **invite-only** — no public sign-up. Staff roles live in JWT **app metadata**:

- **Super** staff can create, update, and delete data, manage users, and configure sports/tracks where restricted.
- Other staff can **view** the full picture but get a clear message when they try to change something they are not allowed to change — **read-only by policy**, enforced in the database with RLS, not only in the UI.

That matters for a university setting: many people need visibility; fewer people should edit master data.

### Outstanding features (elevator pitch)

If you remember only five things, make it these:

1. **Single source of truth** — Web + desktop + imports all write to one Supabase project; no sync nightmares.
2. **Built for NSBM workflows** — Foundation student CSV, four houses, Sports Fiesta vs Inter University, faculty/batch browsing on desktop.
3. **Team Cards + extraction** — From DOCX/XLSX/CSV/images to structured rosters, including OCR for photos on Windows.
4. **Achievement intelligence** — Year filters, categories, gender-aware records, duplicate protection, certificate attachments per result.
5. **Practical ops** — Bulk CSV everywhere it matters, global student search, dashboard counts, dark/light theme, and a desktop app that feels native (session persistence, DPI-aware window, themed chrome).

### Technology — briefly, for discussion

- **Next.js 16** (App Router), **Tailwind CSS**, **TypeScript** on the web.
- **Supabase** — Postgres, Auth, RLS, migrations in-repo for reproducible schema.
- **Desktop** — **.NET 10**, **RecCenter.Core** shared library (services + lightweight PostgREST client), **WPF** shell with **Blazor** UI.

We deliberately stayed on **free-tier-friendly** hosting patterns where possible — appropriate for a focused staff tool, not a consumer-scale product.

### Closing

NSBM Recreation Center Manager is not a generic student information system. It is a **purpose-built operations hub** for the rec center: students and houses, achievements and records, team cards from real-world documents, inventory, and certificates — with **role-based security** and **two ways to work** (browser or Windows) without splitting the data.

I am happy to go deeper on any area — imports, team card extraction, security model, or how we would extend it for the next sports season.

Thank you.

---

## Slide outline (optional)

| # | Title | Talking point |
|---|--------|----------------|
| 1 | NSBM Recreation Center Manager | One portal, one database, web + desktop |
| 2 | The problem | Scattered spreadsheets, duplicate entry, slow lookups |
| 3 | Architecture | Supabase (Postgres + Auth + RLS) + Next.js + Windows desktop |
| 4 | Students & houses | Search, faculties/batches, NSBM CSV import, Ruby/Citrine/Emerald/Sapphire |
| 5 | Achievements | Sports Fiesta & Inter University; records vs team wins |
| 6 | Team Cards | Upload forms/photos → structured rosters (+ OCR on desktop) |
| 7 | Inventory & certificates | Gear counts; certificate files linked to results |
| 8 | Security | Invite-only; super vs read-only enforced in RLS |
| 9 | Highlights recap | Five bullet differentiators |
| 10 | Q&A | Discussion prompts below |

---

## Demo script (5 minutes, if live)

1. Sign in as staff → **Dashboard** counts.
2. **Global search** → open a student → mention house and certificates if present.
3. **Achievements** → switch section → filter by year → show one record row with certificates.
4. **Team Cards** → show an uploaded form or photo → extracted athlete list.
5. **Inventory** → quick quantity edit.
6. (Optional) Open **desktop app** → same login → same student count on dashboard.

---

## Discussion prompts

Use these to steer conversation after the speech:

**Operations**

- Which tasks today still happen outside the system (paper, email, Excel)? Can Team Cards or import close that gap?
- Do we need more reports (e.g. export by house, by sport, by year) for MIC or faculty meetings?

**Data & imports**

- Is the foundation CSV format stable across intakes? Who owns house assignment after import?
- How often do we replace athletic records mid-season, and is the “replace holder?” flow clear enough for staff?

**Access & governance**

- Who should be **super** vs read-only? Should MIC accounts be view-only by default?
- Are certificate uploads sufficient for audit, or do we need reference-number conventions documented for staff?

**Platform**

- Web-only vs desktop at the counter: what do front-desk staff prefer?
- Connectivity: desktop and web both assume online access to Supabase — is that acceptable everywhere we work?

**Roadmap (open-ended)**

- Public read-only leaderboard or house points for display screens?
- Mobile-friendly views for coaches at the field?
- Integration with official university student API instead of CSV?

---

## One-paragraph summary (for handouts or email)

**NSBM Recreation Center Manager** is a staff-only system for managing recreation center data: students across four houses, Sports Fiesta and Inter University achievements and athletic records, team card extraction from documents and photos, equipment inventory, and certificate attachments. It uses Supabase for a secure, shared database with role-based Row Level Security, a Next.js web app, and a Windows desktop client that shares the same backend — emphasizing NSBM-specific imports, fast search, and workflows that match how staff actually receive team entry forms and results.

---

## Presenter notes

- Replace **[morning/afternoon]** and adjust examples (year, sport names) to match the day of the demo.
- If the audience is non-technical, shorten the “Technology” section to one sentence and spend more time on Team Cards and achievements.
- If the audience is technical, be ready to show `supabase/migrations/` and the shared `RecCenter.Core` services mirroring web server actions.
