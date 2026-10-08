# Diyetiko — website + admin

One Next.js app with three faces:

- **Public site** in Turkish (default, no URL prefix), English, Arabic (RTL) and French, with
  localized URLs (`/tarifler`, `/en/recipes`, `/ar/wasafat`, `/fr/recettes`). Recipes with a
  fridge finder and shopping list, guides, a BMR/TDEE calculator, the "Hedefini bul" wizard,
  contact and professional-referral forms.
- **Admin** at `/admin` for the dietitian only: clients, measurements, notes, files,
  appointments, leads, a weekly program builder, share links, recipe/guide CMS, food database,
  settings. A program can also go out as a **share link** (`/p/<token>`): read-only, printable,
  in the program's own language, no login.
- **Client portal** at `/panel` for invited clients: today's plan, daily check-in (water,
  weight, habits, energy), food diary with meal photos, progress charts, messages with the
  dietitian, own-data export and consent withdrawal. The dietitian follows all of it in the
  client's admin page (Takip / Günlük / Mesajlar tabs) and in the Mesajlar inbox. Accounts exist
  only through single-use invite links the dietitian creates — there is no public sign-up.

Out of scope by design: payments, e-commerce, subscriptions, invoices, real-time chat.

**Setting up Supabase for the first time? Follow [KURULUM.md](KURULUM.md)** (Turkish,
step by step).

The visual system ("Kinetic Kitchen") is documented in [DESIGN.md](DESIGN.md).

---

## Quick start (local demo, no accounts needed)

Requirements: Node 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env.local   # leave the Supabase block empty
pnpm dev                     # http://localhost:3000
```

With no Supabase variables the app runs on a **local backend**: real Postgres 17 (PGlite, in
WASM) running the same migrations and RLS policies as production, with demo data, persisted in
`.demo-data/`. Admin login:

- e-mail `muzahim@local.test`
- password `mutfak-demo-2026`

(override with `LOCAL_ADMIN_EMAIL` / `LOCAL_ADMIN_PASSWORD`). A demo **client** account is linked
to the demo client "Deniz Aksoy (demo)" for the portal at `/panel`:

- e-mail `danisan@local.test`
- password `danisan-demo-2026`

(`LOCAL_CLIENT_EMAIL` / `LOCAL_CLIENT_PASSWORD`). To start from a clean demo, stop the dev server
and delete `.demo-data/pg`. When a migration or the seed changes, the dev server rebuilds the demo
database by itself (the old folder is kept as `pg.outdated-<time>`).

If the dev server is killed while writing (closed terminal, crash), PGlite can leave that folder
unreadable ("Aborted()" on startup). The app then renames it to `.demo-data/pg.broken-<time>`
(kept, not deleted), logs a warning and creates a fresh demo database — no manual step needed.
Old `pg.broken-*` folders can be deleted at any time. Only the main dev-server process opens the folder: Next's extra worker processes (static params in dev, parallel build workers) get their own in-memory copy, because PGlite allows one process per data directory. Stop the dev server with Ctrl+C rather than
killing the process. The local backend refuses to start in production
unless `ALLOW_LOCAL_BACKEND=1` (used only to run the e2e suite against `next start`).

## Scripts

| Command                                              | What it does                                                                                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`             | Next.js                                                                                                                                                                                             |
| `pnpm dev:local`                                     | Dev server on the local demo backend even when `.env.local` holds Supabase credentials (used by the e2e suite)                                                                                      |
| `pnpm typecheck` · `pnpm lint` · `pnpm format`       | TypeScript strict · ESLint · Prettier                                                                                                                                                               |
| `pnpm test`                                          | Vitest: nutrition math, program totals, slug/Turkish casing, seed integrity, **RLS proof**                                                                                                          |
| `pnpm db:test`                                       | Only the database tests (RLS proof + the pgTAP file through a shim)                                                                                                                                 |
| `pnpm test:e2e`                                      | Playwright tests (starts `pnpm dev:local` if nothing is running; refuses to run against a server on the real Supabase project)                                                                      |
| `node scripts/gen-seed.ts`                           | Regenerates `supabase/seed.sql` + `supabase/local/demo.sql` from `lib/content/seed/*`                                                                                                               |
| `node scripts/gen-og.mjs`                            | Renders `public/og/og-<locale>.png` from `/dev/og` (needs `pnpm dev`)                                                                                                                               |
| `node scripts/screenshots.mjs`                       | Screenshots by path/locale/width (`--login` admin, `--portal` demo client, `--portalLocale=ar`); used for design review                                                                             |
| `node scripts/verify-share-pdf.mjs`                  | Share page in a program language (default `ar`) → screenshots + a real PDF                                                                                                                          |
| `node scripts/vitals.mjs`                            | Lab LCP/CLS on mobile with CPU/network throttling (run against `pnpm start`)                                                                                                                        |
| `node scripts/font-probe.mjs <path>`                 | Lists text rendered with a system fallback font instead of the brand faces                                                                                                                          |
| `node scripts/calc-audit.mjs`                        | Drives the energy & macro calculator through 120 input combinations in a real browser and compares every number, the BMI label and the gauge (needle, BMR tick, band) with an independent reference |
| `node scripts/touch-audit.mjs`                       | Phones + touch tablets (360–1366 px): sideways overflow, tap targets < 44 px, inputs < 16 px, clipped strips                                                                                        |
| `node scripts/nav-crawl.mjs --locale=tr --width=390` | Clicks through the site like a visitor (client-side navigation) and reports every page error                                                                                                        |

In Git Bash on Windows, prefix scripts that take URL paths with `MSYS_NO_PATHCONV=1`.

The dev server compiles from the files on every start: Turbopack's on-disk dev cache is switched
off (`experimental.turbopackFileSystemCacheForDev: false` in `next.config.ts`). `pnpm dev` and
`pnpm dev:local` share one `.next/dev`, and a compilation restored from disk after a hard stop was
served older on the server than in the browser — seen as "a tree hydrated but some attributes
didn't match". If a page ever looks like an older version of itself, stop the server and delete
`.next/dev`.

---

## Production setup (Supabase + Vercel)

> The step-by-step version, in Turkish, with checks after each step and a troubleshooting
> table: **[KURULUM.md](KURULUM.md)**. The summary below is for developers.

### 1. Supabase project

1. Create a project (region close to Türkiye, e.g. Frankfurt). Postgres 17.
2. **Apply the migrations**, in order. Either with the CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   or paste the ten files from `supabase/migrations/` into the SQL editor, in filename order.
   They create the schema, enable RLS on every table, add the policies, the recipe-nutrition
   triggers, `get_shared_program`, `rate_limit_hit`, the client portal (invites, habits,
   check-ins, diary, messages, `portal_*` functions), the dietitian's task list (`tasks`,
   owner-only), packages / payments / lab results (`client_packages`, `payments`, `lab_results`,
   owner-only) and the Storage buckets + policies (`recipe-media` and `site-media` public,
   `client-files` and `diary-photos` private). An existing project only needs the files it has not run yet
   (`20261001000005_tasks.sql`, `20261002000006_practice.sql`, `20261003000007_applications.sql`,
   `20261003000008_fix_json_strings.sql` — a repair, see "JSON parameters" below;
   `20261005000009_uploads_activity.sql` — files in messages, movement in the check-in;
   `20261006000010_client_care.sql` — tasks shared with the client, the client's own billing);
   until then the cards that need them say so instead of failing, and applications are stored as
   contact leads marked `payload.form = 'application'` (shown as applications all the same).
3. **Auth settings** (Authentication → Providers / Settings):
   - Email provider on, **sign-ups off** (client logins are created server-side from invites).
   - Site URL = your production URL; add `https://<domain>/admin` as a redirect URL.
   - Multi-factor → TOTP enabled (the dietitian enrols from Admin → Ayarlar → Güvenlik).

### 2. Create the admin user

Authentication → Users → **Add user** → e-mail + a strong password, "Auto confirm user" on.
This is the dietitian's account; there is no sign-up page. A `profiles` row is created for it
automatically. **It must be the first account**: the first profile gets `role = dietitian`, every
later one `client` (and accounts created with `app_metadata.role = client` are always clients).

### 3. Seed the public content

Only after the user exists (the seed assigns every row to the first auth user, and refuses to
run otherwise): run `supabase/seed.sql` in the SQL editor (or `psql "$DATABASE_URL" -f
supabase/seed.sql`). It inserts 83 foods, 13 recipes and 6 guides in four languages, plus
default site settings. **It contains no clients or personal data.** (`supabase/local/demo.sql`
has fake demo clients and is only for the local backend — never run it in production.)

### 4. Environment variables (Vercel → Settings → Environment Variables)

See [.env.example](.env.example) for the full, commented list. Production needs:

| Variable                                                                                                       | Notes                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                                                         | `https://<domain>`, no trailing slash                                                                                                                                                                                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Project Settings → API Keys. Supabase's Connect dialog calls them `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` — same values, add the `NEXT_PUBLIC_` prefix                                                                                                                                              |
| `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`)                                                  | Server-only, **never** `NEXT_PUBLIC_` (the app refuses to start if a secret key sits in a public variable). Used only by `lib/auth/accounts.ts` (Admin API) to create / reset / delete **client** portal logins. Without it the site works but portal invites are disabled (the admin shows a warning). |
| `DATABASE_URL`                                                                                                 | **Transaction pooler** string (port 6543). Server-only.                                                                                                                                                                                                                                                 |
| `IP_HASH_SALT`                                                                                                 | 32+ random characters. Required — the app refuses to start without it.                                                                                                                                                                                                                                  |
| `ANTHROPIC_API_KEY`                                                                                            | Optional; enables "Taslak çeviri" for public recipes/guides only.                                                                                                                                                                                                                                       |

Do **not** set `ALLOW_LOCAL_BACKEND` or `PREVIEW_UNREVIEWED_TRANSLATIONS` in production.

### 5. Deploy

Import the repo in Vercel (framework preset: Next.js, install `pnpm install`, build
`pnpm build`). After the first deploy:

- Log in at `/admin/login`, enrol TOTP in Ayarlar → Güvenlik.
- Fill Ayarlar (contact, bio, credentials, images) — see _Content needed_ below.
- Check `/sitemap.xml`, `/robots.txt`, and share a test program link to your own phone.

### Generated database types

Row types live in `types/` and are normalized at the boundary by `lib/db/parsers.ts` (dates →
ISO strings, numerics → numbers). If you prefer generated types:
`supabase gen types typescript --linked > types/supabase.ts`.

---

## How it works

### Data access and RLS

All SQL goes through `lib/db`: `asUser(uid)`, `asAnon()`, `asService()`. Each call opens a
transaction, sets `request.jwt.claims`, and switches to the `authenticated` / `anon` /
`service_role` role — so **RLS decides on every query**, in production (postgres.js over the
pooler) and locally (PGlite) alike.

- Every table has RLS. Practice data is owned by the dietitian: owner policies compare
  `owner_id` with `public.staff_uid()` (= `auth.uid()` **only if** the profile's role is
  `dietitian`), so a signed-in client matches no owner policy at all. Child tables check the
  parent's owner, so cross-tenant inserts fail. `profiles.role` is not writable by users.
- `anon` can read only published recipes/guides, their non-draft translations, foods used by
  published recipes, and public settings. Nothing else.
- `service_role` (bypasses RLS) is used in these server-only places: **lead intake** (after zod
  validation, honeypot and rate limit), the **rate-limit counters**, and the **invite
  functions** `peek_client_invite` / `redeem_client_invite` (executable only by
  `service_role`). The Supabase service-role **API key** is used only in
  `lib/auth/accounts.ts`, and its delete refuses any account whose role is not `client`.
- `audit_log` is append-only (no UPDATE/DELETE grants). Logged: client view/create/update/
  archive/restore/hard delete/export, Danışan Gezgini opens, client file reads, lead
  conversion, share link create/revoke.
- Proof: `supabase/tests/rls.test.ts` (Vitest on PGlite, mutation-checked) and
  `supabase/tests/database/rls.test.sql` (pgTAP for `supabase test db`; also executed in
  Vitest through a small pgTAP shim).

### Client portal (`/panel`)

**Accounts.** The dietitian creates an invite (Admin → client → Genel → Danışan paneli). The
token is 32 random bytes (base64url); only its **SHA-256** is stored, it expires (invite 7
days, password reset 2 days), is single-use, and creating a new one closes older ones. The link
is shown once; the admin offers copy / WhatsApp (message in the client's language) / QR. The
client sets a password; the server creates the login (Supabase Admin API; locally the stand-in
`auth.users`), links it to the client record through `redeem_client_invite` and signs them in.
"Panel erişimini kapat" deletes the login (the client's records stay with the practice); hard
deleting a client also removes the login and every diary photo.

**Consent (KVKK, health data).** `public.my_client_id()` returns the caller's client id only
while the account is linked, the record is not archived **and explicit portal consent is
recorded** (`portal_consent_at` + version). Without it every client policy and portal function
returns nothing. Consent is given on the invite page (or `/panel/consent`) and can be withdrawn
in Hesabım.

**What a client can read.** Their own check-ins, diary and messages (RLS), their active habit
goals, and — only through SECURITY DEFINER `portal_*` functions returning DTOs — their
profile basics, current active program, clinic measurements, appointment times/kinds and the
dietitian's food list. Internal notes, medical notes, appointment notes/titles, files, other
clients: never (asserted in `supabase/tests/portal.test.ts`, 17 tests).

**What a client can write.** Check-ins (weight, water, habit ticks, energy, note), diary meals
and items, messages, meal photos. `owner_id` always comes from the client record (trigger),
never from the request; diary nutrition values are computed in the database from the food /
recipe (`diary_item_compute`) — a client cannot submit their own numbers. Column-level grants
keep `clients.user_id` and the consent columns out of reach of both sides' direct SQL.

**Meal photos.** Resized in the browser (≤ 1600 px JPEG, which also drops EXIF/GPS), then posted
to `/api/portal/photo` (auth, rate limit, 4 MB cap, magic-byte sniffing) into the private
`diary-photos` bucket at `<dietitian>/<client>/<uuid>.jpg`; storage policies allow the client
only their own folder and the dietitian only their practice. Served through auth-checked routes
(`/api/portal/photo/[mealId]`, `/api/admin/diary-photo/[mealId]`), never public URLs.

**Surface.** `/panel` has its own layout (`data-surface="portal"`), its own language cookie
(`PORTAL_LOCALE`, defaulting to the client's preferred language), `noindex`, and the strict
nonce CSP from `proxy.ts`. A dietitian opening `/panel` is sent to `/admin`; a client opening
`/admin` is sent to `/panel`. The dietitian's program view is shared with the share page
(`components/program/program-view.tsx`).

### Dietitian dashboard and client overview (`/admin`)

- **Today**: the day's appointments on a timeline with a live "now" line; one tap marks a
  started appointment _came_ / _no-show_; a WhatsApp reminder link is prefilled in the
  **client's** language (`portal.reminderText`, Istanbul time). wa.me links are opened by the
  dietitian — nothing is sent automatically.
- **Needs attention** (`lib/admin/signals.ts`, unit-tested): unread messages, weight moving
  ≥ 1 kg away from the goal within 21 days, a portal client quiet for 4+ days, missing KVKK
  consent, overdue tasks, no measurement for 21+ days, no booked appointment 28+ days after the
  last one. Each reason links to the profile tab that resolves it.
- **Goal board** and the client **overview**: one weight timeline (clinic measurements + portal
  check-ins, the clinic value wins on the same day), least-squares trend over 6 weeks, an
  estimated arrival only when the trend points at the goal and is under two years away.
- **Clinical indicators**: BMI (WHO cut-offs), weight for BMI 18.5–24.9, waist/height (0.5),
  waist/hip (WHO 0.90 / 0.85), Mifflin-St Jeor resting and daily energy with the same
  `calculate()` as the public calculator. Shown as prompts, with what is missing; never sent
  anywhere.
- **Tasks** (`tasks` table): optional client and due day; ticks are undoable for 24 hours.
- **Measurement comparison**: any two days side by side, copyable as text.
- **Packages & payments** (`client_packages`, `payments`): a package is N sessions and/or a
  period at a price. Appointments marked _came_ count against the package valid that day
  (`lib/admin/practice-logic.ts`, unit-tested); paid / owed per currency, never mixed. The
  dashboard's revenue card shows this month vs last month, what is owed, and packages to talk
  about (last session, finished, unpaid). Amounts are typed in the panel's own number style.
- **Files in messages** (migration 9): a client sends a PDF or a photo (a lab report) from the
  portal, the dietitian can send one back. Stored in the private `client-uploads` bucket under
  `<dietitian>/<client>/`; the message trigger refuses a path outside the client's folder, storage
  RLS refuses the rest. The type is read from the bytes (PDF / JPEG / PNG / WebP, 10 MB), files are
  served only through auth-checked routes (`/api/portal/attachment/[id]`,
  `/api/admin/message-file/[id]`) with `nosniff`. Shown in the thread, on the messages page and
  under the client's "Dosyalar" tab; removed with the client on permanent deletion.
- **Messages page** (`/admin/messages`): conversations beside the chosen thread, with search,
  unread / with-files filters, shortcuts into the client's file and the files exchanged so far.
- **Movement** (migration 9): minutes and kind of activity in the daily check-in; the dietitian
  sees the week's total and each day under "Takip".
- **Shared tasks** (migration 10): a task linked to a client can be marked "Danışan da görsün".
  The client sees it on Today and ticks it (`portal_task_done`, security definer: only their own
  shared tasks, only the tick); the dietitian sees "Danışan tamamladı". Unshared tasks never
  leave the panel.
- **The client's appointments and billing** (`/panel/care`, migration 10): upcoming and past
  appointments with "add to calendar", the package with sessions used, paid and left, and the
  payments — read-only through `portal_billing()` (never the dietitian's notes).
- **Plan adherence** (`planAdherence`, unit-tested): on the client's "Takip" tab, the planned
  meals of the last seven days that were logged in the diary.
- **In-product guide** (`/panel/help`, `/admin/help`): how each page is used — a real picture of
  the page with numbered pins, and steps from `portal.help` / `admin.help` in the message files.
  The pictures (`public/guide/<scope>/<locale>[-dark]/<topic>.webp`) and pin positions
  (`lib/guide/pins.json`) are produced by `node scripts/guide-shots.mjs` against the **local demo
  backend only** (fictional seed data; never run it against the real project). Re-run it after a
  page changes visibly, and add the page to the script and to the topic list when a page is
  added. The en/ar/fr guide texts were written with the Turkish and need a native read before
  launch.
- **Portal extras**: weekly summary (`/panel/week`), files (`/panel/files`), shopping list from the
  programme (`/panel/shopping`, `lib/portal/shopping.ts`, unit-tested; ticks live in the browser).
- **Before migrations 9 and 10 are run** the app works as before: `lib/db/features.ts` asks which columns
  exist and the file / movement controls stay hidden.
- **Payments page** (`/admin/payments`): all clients' payments by month, filtered by date,
  method and name, with what is still owed on open packages; a payment can be recorded for any
  client from here. The CSV is built in the browser from the rows shown.
- **Date filter** (`lib/admin/date-range.ts`, unit-tested): the same ranges on every list,
  counted in Istanbul calendar days.
- **Lab results** (`lab_results`): 19 common tests with their usual units; the reference range
  is always copied from the lab's own report (the app assumes none). Out-of-range flags, trend,
  HOMA-IR (glucose × insulin / 405) when both are drawn the same day.
- **Progress report** (`/admin/report/[id]`): one printable page in the client's language —
  weights, circumferences, measurements, lab values. Opening it is audited like an export.
- **Repeating appointments**: weekly or every two weeks, up to 12 in one go.
- **Programme applications** (`/basvuru`, lead kind `application`): four steps — programme
  (3 / 6 / 12 months; there is no one-month option and the applicant confirms it), the person,
  optional health background under explicit consent, contact. Same intake as every lead (zod,
  honeypot, rate limit, service role). In the panel: Requests → "Başvuru", with the details laid
  out; converting fills sex, height, activity, allergies, health notes, goal and a first
  (self-reported) weight into the new client record.
- **Cookie choice and the programme invitation** (`components/site/cookie-consent.tsx`,
  `apply-prompt.tsx`, queued by `prompts.ts`): accept / reject stored in `dm_consent`; the site
  sets only necessary cookies today, so the choice gates anything optional added later
  (`optionalCookiesAllowed()`). The invitation shows once interest is shown and respects "later".
  Public e2e tests run as a returning visitor (`e2e/visitor-state.json`); `prompts.spec.ts`
  starts clean.
- **Getting in without typing /admin**: sign-in links (client / dietitian) in the site footer
  and menu; the panel is installable (`/admin/manifest.webmanifest`, PNG icons from
  `/admin/app-icon/[size]`, an "install" item in the sidebar where the browser supports it), so
  it opens from the home screen or dock.

### JSON parameters

Callers pass json/jsonb values as text made by `json()` (`lib/db/types.ts`). The postgres.js
driver is configured to send that text as it is (`serializeJson`, `lib/db/parsers.ts`) — its default
JSON.stringify encoded it a second time on live projects, storing strings like
`"{\"duration\":\"m6\"}"` (PGlite never did, so local tests could not see it). Reads unwrap such
old rows (`parseJson`), and migration …000008 repairs them in place.

### Share links

`share_links.token` = 32 random bytes, base64url (43 chars). `/p/[token]` resolves the token
**server-side only** through the `get_shared_program` SECURITY DEFINER function, which returns
a sanitized DTO: program content, targets, and — only if the dietitian ticked "show name" —
the client's **first name**. Never surname, phone, e-mail, notes, measurements or ids (asserted
in tests and in the e2e suite). Links can expire (7/30/90 days or never) and be revoked; the
admin sees view count and last view. Share pages are `noindex`, `no-referrer`, and use a strict
nonce CSP.

**PDF:** the share page is the printable document (print stylesheet, one day per page; the
"Yazdır / PDF" button uses the browser's print-to-PDF). No PDF library is involved, so Arabic
shaping is whatever the browser does — verified with a real Chromium PDF of an Arabic program
(`scripts/verify-share-pdf.mjs`): joined letters, brand fonts embedded, no system fallback. If
"allow PDF" is off, printing is blocked by CSS.

### Internationalization

- `next-intl` with localized pathnames (`lib/i18n/routing.ts`); `tr` has no prefix. Arabic
  paths are Latin transliterations.
- `<html lang dir>` per locale; logical CSS properties throughout; directional motion mirrors
  in RTL. Arabic is never split per character (word-level animation only), no letter-spacing,
  no uppercase/italic. Turkish casing uses `toLocaleUpperCase('tr')` (İ/ı handled).
- Fonts per script: Bodoni Moda / Schibsted Grotesk / Martian Mono for Latin; Amiri / Readex Pro
  for Arabic (Arabic fonts are not preloaded; they are only fetched on Arabic pages).
- Numbers via `Intl`; Arabic uses Latin digits by default (switchable in Ayarlar → Profil).
- The language switcher remembers the choice in a cookie; the first visit may _suggest_ a
  language from `Accept-Language` once — it never redirects on its own.
- DB content uses translation tables with `translation_status` = `draft | needs_review |
reviewed`. Fallback chain: requested locale → en → tr, with a visible notice.
  **Visibility rule:** `tr`/`en` show when `needs_review` or `reviewed`; **`ar`/`fr` only when
  `reviewed`** (a native speaker must approve health content). `PREVIEW_UNREVIEWED_TRANSLATIONS=1`
  lets a reviewer preview locally.
- hreflang alternates (+ `x-default`) on every page, localized sitemap, localized metadata and
  Open Graph images (`public/og/`, rendered by Chromium — Satori can't shape Arabic).

### Draft translation (optional)

With `ANTHROPIC_API_KEY` set, the recipe/guide editors show "Taslak çeviri" for a target locale.
It sends only that **public** recipe/guide text, validates the response with zod, and saves it as
`needs_review`. **Client data is never sent to any third-party AI service** — the action only
accepts recipe/guide ids and is rate-limited (30/hour).

### Nutrition

- Recipe nutrition is derived in the database from ingredients (`recompute_recipe` triggers);
  diet flags (vegetarian, vegan, gluten-free, dairy-free) are derived from food flags.
- Tags are data-derived with fixed thresholds (per serving):
  `high_protein` ≥ 20 % of energy **and** ≥ 15 g · `high_fiber` ≥ 6 g · `under_400` ≤ 400 kcal ·
  `quick` ≤ 20 min total.
- Calculator: Mifflin–St Jeor BMR × activity factor; goal adjustments never go below BMR; BMI is
  shown with its limitations and a disclaimer. The wizard asks no medical questions.
- All 83 seed foods are marked **needs review** — values are approximate references until the
  dietitian verifies them against a trusted source (e.g. TürKomp) in Admin → Besinler.

### Security and privacy (KVKK)

- Headers: HSTS (2 years, preload), `X-Frame-Options: DENY`, `nosniff`, strict referrer policy,
  restrictive `Permissions-Policy`. CSP: static policy for the public site; per-request **nonce +
  `strict-dynamic`** for `/admin`, `/panel` and `/p/*` (set in `proxy.ts`).
- Rate limits (salted IP hash, never raw IPs): login 8/15 min, MFA 10/15 min, public forms
  5/10 min, draft translation 30/hour; portal: login 10/15 min, invite redemption 10/15 min,
  password change 5/15 min, messages 20/10 min, photo uploads 40/10 min, data export 10/10 min.
- Forms: zod on the server, honeypot, explicit consent with timestamp + consent-text version
  stored on the lead.
- No analytics, no third-party trackers, no third-party scripts or fonts at runtime (fonts are
  self-hosted by `next/font`). Only necessary cookies (language, dismissed suggestion, admin
  session). No client data in logs.
- Client files: private bucket, 60-second signed URLs, reads audited. Uploads limited to 10 MB
  and an allow-list of types.
- Clients: soft delete (archive/restore) and hard delete; CSV export escapes formula injection.
  The per-client JSON export (KVKK access request) includes the portal data (habits, check-ins,
  diary, messages). Clients can download their own data from Hesabım (`/api/portal/export`).
- Legal pages (Gizlilik, KVKK aydınlatma, Çerez) are **placeholders** marked "hukuki inceleme
  gerekli" — they need a lawyer.

### Motion and accessibility

GSAP + ScrollTrigger are dynamically imported by the scroll-driven home sections (never in the
initial bundle, never in admin); Lenis runs on the public site only. `prefers-reduced-motion`
(and Save-Data, as a lighter "lite" level) switch every signature moment to a static
equivalent — the hero skips GSAP entirely; the story section still loads it but its
`gsap.matchMedia` conditions create no animation.
The custom cursor and magnetic effects exist only for fine pointers. Admin animations are ≤ 250 ms.

### Hidden design kit

`/dev/kit` shows tokens, type per script, every primitive in every state and the motion presets.
`/dev/kit` and `/dev/og` return **404 in production** builds.

---

## Libraries beyond the requested stack

| Library                       | Why                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres` (postgres.js)      | Direct SQL over the Supabase pooler so each request can switch role + JWT claims inside a transaction (RLS on every query) without an ORM.                |
| `@electric-sql/pglite` (dev)  | Real Postgres in WASM: the local demo backend and the RLS test suite run the _same_ migrations as production. Loaded only when Supabase isn't configured. |
| `@supabase/supabase-js`       | Required by `@supabase/ssr` (Auth, MFA, Storage).                                                                                                         |
| `tailwind-merge`, `clsx`      | Class composition for the primitives.                                                                                                                     |
| `server-only`                 | Build-time guard that DB/secret modules never reach the client.                                                                                           |
| `@gsap/react`                 | `useGSAP` cleanup for ScrollTrigger in React 19.                                                                                                          |
| `prettier-plugin-tailwindcss` | Stable class order.                                                                                                                                       |

PDF: no library (see _Share links_). Charts: custom SVG on the public site, Recharts in admin
(lazy-loaded).

---

## Testing

- **Unit** (`pnpm test`, 112 tests): nutrition math and invariants, program totals, builder state,
  slugs and Turkish casing, seed integrity, RLS proof (17), pgTAP file via shim (31 assertions),
  **client portal security** (17: roles, consent gate, DTOs never leak internal notes, owner/nutrition
  forging refused, photo folders, message rules), portal data layer and date/streak/chart helpers,
  **i18n parity** (all four message files have the same keys and ICU placeholders).
- **E2E** (`pnpm test:e2e`, 58 tests): client portal end to end — dietitian creates a client,
  a habit and an invite → the client sets a password + consent → the link is dead afterwards →
  water / habit autosave → diary food from the database + a real JPEG upload → message → client
  blocked from `/admin` → the dietitian sees tracking, diary photo and message, replies → the
  client sees the reply → access closed (client signed out, records kept) → hard delete (photo
  gone); each surface guards the other; every portal page at 390 px in tr and ar (no sideways
  scroll, no page errors). Plus: home in 4 locales (lang/dir/hreflang/no page errors), RTL
  sanity (no sideways scroll, mirrored header, word-level Arabic headline), invalid locale → 404,
  recipe filters + server-rendered cards + `?mode=` deep link, wizard → consented lead (and it
  appears in the admin inbox), `?goal=` preset, admin route guard + API refusal + CSP, share link
  create → open signed out (no PII in HTML) → revoke → 404. Also run against `next start`.

---

## Verification status (honest)

Verified by actually rendering and looking (Playwright screenshots, reviewed), and by tests:

- Public: home in tr/ar desktop (multiple rounds) and mobile hero; inner pages in tr desktop;
  Arabic recipe listing, tools and about pages checked for font fallbacks (none); en/fr home via
  e2e only.
- Admin: dashboard (light/dark), clients, explorer, programs, builder (1440 + 390, tr + ar),
  leads, appointments, recipes, guides, foods, settings (tr + ar).
- Share page: tr 390/1440, ar 390/1440, print layout at A4 width, real PDF (fonts embedded, no
  fallback).
- Production build: 0 warnings; production server: CSP/HSTS headers, `/dev/*` 404, full e2e
  suite green. Lab vitals (mobile, 4× CPU, Fast 4G): LCP 0.7–1.4 s, CLS 0.000 on 10 routes.

- Client portal: every page at 390 / 768 / 1024 / 1440 in tr, 390 + 1440 in ar / en / fr
  (screenshots reviewed, RTL fixes made); admin portal tabs and inbox at 1440 and 390.

Not yet verified by eye: en/fr inner pages at all widths, 768 px layouts, reduced-motion
screenshots of every page, the Supabase deployment itself (Auth, MFA enrolment, Storage uploads,
client invites through the Supabase Admin API, pgTAP under the real CLI) — these paths are implemented and type-checked but were exercised only
against the local backend. Run through them once on the real project.

---

## Content needed from the dietitian (Diyetisyenden gereken içerik)

Nothing below was invented; every item is a visible placeholder or a "needs review" flag until
filled. Most can be done in **Admin → Ayarlar** without a developer.

- [ ] **Cinsiyet ifadesi (FR/AR):** Fransızca ve Arapça metinlerde unvan eril yazıldı
      ("Diététicien", "أخصائي التغذية"). Doğru ifade hangisi? (Diététicien/Diététicienne,
      أخصائي/أخصائية) — onaydan sonra çeviri dosyaları güncellenmeli.
- [ ] **Portre fotoğrafı** (Ayarlar → Marka görselleri). Şu an çizim yer tutucu var.
- [ ] **Biyografi** (Ayarlar → Site içeriği → Hakkımda), 4 dil.
- [ ] **Eğitim ve yetkinlikler**: diploma, üniversite, sertifikalar, mesleki kayıt/üyelikler.
      Yalnızca belgelenmiş bilgiler (Hakkımda ve Meslektaşlar sayfalarında görünür).
- [ ] **İletişim**: e-posta adresi, (varsa) adres/ofis; telefon ve Instagram doğru mu?
- [ ] **Çalışma ilkeleri ve süreç metinleri** (Hakkımda, ana sayfadaki 4 adım, SSS): geliştirici
      tarafından yazıldı — içerik ve ton onayı gerekli.
- [ ] **Hukuki metinler**: Gizlilik politikası, KVKK aydınlatma metni (veri sorumlusu bilgileri
      dahil), çerez politikası — **hukuki inceleme gerekli**. Formlardaki onay metinleri de.
- [ ] **Danışan paneli açık rıza metni** (`portal.auth.consentBody`, 4 dil; sürüm
      `portal-2026-01`): yer tutucudur, **hukuki inceleme gerekli**. Metin değişirse
      `PORTAL_CONSENT_VERSION` (lib/portal/data.ts) yükseltilmeli. Gizlilik/KVKK sayfalarına
      danışan paneli (sağlık verisi, öğün fotoğrafları, mesajlar, saklama süresi) eklenmeli.
- [ ] **Danışan paneli saklama süresi**: danışman ilişkisi bittiğinde panel kayıtları ne kadar
      tutulacak? (Şu an diyetisyen silene kadar kalır.)
- [ ] **Besin veritabanı**: 83 besinin değerleri "doğrulanmadı" — güvenilir kaynakla (ör.
      TürKomp) kontrol edip "doğrulandı" işaretlenmeli (Admin → Besinler).
- [ ] **Tarifler ve rehberler**: 13 tarif ve 6 rehberin içerik onayı; tarif fotoğrafları
      (isteğe bağlı — şu an el çizimi illüstrasyonlar kullanılıyor).
- [ ] **Paylaşım (OG) görseli**: isterseniz özel görsel yükleyin; yoksa 4 dilde hazır kart kullanılır.
- [ ] Referans/yorum, fiyat, önce-sonra fotoğrafı, istatistik: **sitede yok ve uydurulmadı.**
      Eklenmesi istenirse gerçek, izinli içerikle eklenmeli.

## Arabic & French translation review checklist

For a native speaker of each language (ideally with a nutrition background). Arabic and French
content stays hidden on the site until it is marked **reviewed**.

UI strings (`messages/ar.json`, `messages/fr.json`):

- [ ] Professional title and gender agreement for the dietitian (see first item above). The
      client portal uses "أخصائي التغذية" and a neutral "ton suivi" in French.
- [ ] Client portal (`portal.*`) and invite messages (`portal.inviteText`): tone (French uses
      "tu" like the rest of the site), health wording, the consent text.
- [ ] Navigation, buttons, form labels, error messages, consent texts.
- [ ] Health wording: no promises, no diagnosis/treatment language, body-neutral tone.
- [ ] Calculator and wizard: activity levels, goal names, disclaimers, BMI limitations.
- [ ] Units and abbreviations (Arabic: سعرة, غ, macro abbreviations ب/ك/د) — natural?
- [ ] Arabic URL slugs (Latin transliteration, `lib/i18n/routing.ts`) acceptable?
- [ ] Arabic: digits (Latin by default), punctuation (، ؛ ؟), no stretched/uppercased text.

Database content (Admin → Tarifler / Rehberler, per-language tab):

- [ ] 13 recipes: title, summary, ingredients (food names in Admin → Besinler), steps.
- [ ] 6 guides: title, excerpt, body; sources kept as-is.
- [ ] Site content per language: hero, bio, credentials, FAQ (Admin → Ayarlar → Site içeriği).
- [ ] After review, set each item's status to **İncelendi / reviewed**.
