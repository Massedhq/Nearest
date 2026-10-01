# Nearest — Project Rules

Nearest is a DFW booking marketplace. Verified students book verified beauty professionals, including discounted **Model Calls**. It is a PWA with three separate doors in one codebase:

| Door | URL | Who |
|---|---|---|
| Student app | `nearest.com/` | Verified students only |
| Pro portal | `nearest.com/pro` | Professionals, invite-driven (founding 750) |
| Admin | `nearest.com/admin` | The three owners and future staff |

The student app never shows a professional sign-up option. Professionals arrive through an invitation link a sales rep sends, or through `/pro` directly.

## Stack (do not substitute)

- Next.js (App Router) + TypeScript, deployed on Vercel
- Neon Postgres with Drizzle ORM (`src/db/schema.ts`, migrations in `drizzle/`)
- Clerk v7 (Core 3) for sign-in, email-code verification and sessions. Nearest never sends text messages; all codes and alerts go by email or in-app. `<SignedIn>`/`<SignedOut>` no longer exist; use `<Show>`.
- Next.js 16: route protection lives in `src/proxy.ts` (the old `middleware.ts` name is deprecated). Read `node_modules/next/dist/docs/` before using an unfamiliar API.
- Money is always stored as **integer cents**
- Times are stored in UTC and displayed in `America/Chicago`

Never keep login state in localStorage. Every protected page and API route checks the Clerk session **and** the user's role in our database on the server.

## Design

- The approved mockups live in `/design/screens/*.dc.html`. Match them. When a page is built, name its mockup file in the commit message.
- The mockup stylesheet is `/design/nearest.css`. It is ported into `src/app/globals.css`, so components use the same class names as the mockups (`card`, `btn`, `chip`, `field`, `tabbar`, and so on).
- Fonts: Bodoni Moda for display and Manrope for body text, self-hosted with `@fontsource-variable/*` (imported in `src/app/layout.tsx`). Don't switch to `next/font/google`.
- Logos: `/public/brand/nearest-wordmark.png` and `/public/brand/nearest-monogram.png`.
- Icons are simple line icons (stroke 1.6), never emoji.

## Business rules live in the database

Every number in the rules engine (24-hour booking notice, 12:00 PM same-day cutoff, 15-minute grace, 100-ft check-in, $5 deposit, $50 fine, founding capacity 750, 5 pros per city, 7-day invite expiry, and the rest) is read from the `platform_settings` table. Never hardcode them. The owner changes them in Admin → Rules & Settings.

## Privacy rules

- A professional's street address is never sent to the browser except to a booked student on the day of the appointment (later phase).
- ID images and selfies are held by the verification provider, never uploaded to our storage.
- Phone numbers and emails are never shown between students and professionals.

## Audit log

Every admin write (invite, pause, refund, setting change, status switch) inserts a row into `activity_log` with the admin's user id, action, target and before/after values. The log is never updated or deleted.

## Database commands

- `npm run db:push` applies `src/db/schema.ts` to Neon.
- `npm run db:seed` loads counties, cities and the rules engine. It's safe to rerun and never overwrites a rule the owner changed.
- `npm run db:studio` opens a browser view of the tables.

## Status

- Phase 1 (foundation) is built. See `docs/PHASE-1.md`.
- Phase 2 (professional side) is built. See `docs/PHASE-2.md`.
- Phase 3A (student verification, search, model calls) is built. See `docs/PHASE-3A.md`.
- How Nearest works guides: `/guide` (students), `/pro/guide` (pros), `/admin/guide` (admin) — in-app only (signed in). Never add a public guide page or link it from welcome/join pages (owner's rule: don't expose the model). Content lives in `src/lib/guide.ts` and reads every number from the rules engine — when a feature or rule changes, update the matching guide topic in the same change.
- Go live: pros control their own visibility with `setGoLive` (GoLiveCard on Today + Business) — it flips `searchable`. `proReadiness()` in live-check.ts lists what is left in pro wording (same checks as proBlockers). Payouts are NEVER a go-live or search requirement; earnings are held until the pro connects.
- Special invitations (main owner only, `createSpecialInvite`, checked server-side with `mainOwnerId()`): `invitations.kind` = FIRST_IN | AMBASSADOR | BOOKING_PAID (+ `rate_cents`). Redeeming a managed kind sets entryType, entryPaidAt, `subscriptionStatus: "active"` (Nearest-managed, no Stripe subscription). BOOKING_PAID dues: `collectDues()` in src/lib/dues.ts runs before EVERY pro payout (release, late-cancel deposit, no-show deposit) — one `membership_dues` row per booking, capped at the month's rate. Any new payout path must call it too. Join page rejects managed types.
- Client photos: `savePhoto` NEVER adds to the portfolio. Photos live on the booking (`photo_url`, client consent `photo_for_portfolio`, pro choice `photo_status`: null=private, "shown"=under the review, "removed"). Pro manages them at /pro/client-photos (show with review, add to portfolio → portfolio_items.from_booking_id, download via /api/pro/client-photo/[id], remove). Showing/adding requires client consent. Seed deletes legacy auto-added rows (source nearest, from_booking_id null).
- Categories & services: the full list (17 categories, 252 services) lives in src/db/seed.ts CATEGORIES; seed only adds (never removes/renames). License is per category, so services are grouped by license. Service coverage (/admin/service-coverage) counts joined pros per city × category vs `growth.target_per_category` (5) and `growth.market_goal` (1500).
- Portfolio videos: `portfolio_items.kind` ("image" | "video") + `duration_sec`. Limits in src/lib/portfolio-limits.ts (10 photos, 5 videos, 15 s, 100 MB). Length is checked in the browser AND on the server from the file header (`videoSeconds()` in src/lib/video-length.ts, MP4/MOV mvhd) — over 15 s is deleted and refused. Anything that renders portfolio items with next/image must filter `kind = "image"`.
- Sales Board (main owner only — page notFound + every action re-checks `mainOwnerId()`): `sales_reps` table, separate from admin_members/partners and invitations. Invite → /rep/join/[token] (email locked to the invite) → /api/rep/accept links login (verified email must match) → /rep dashboard. Rep links `?rep=CODE` → `nearest_rep` cookie (30 days, proxy) → `users.rep_id` set when the student/pro account is created (`repIdFromCookie`, active reps only). Students are never named to reps. Sign-in honors redirect_url ONLY for /rep paths. Invitations no longer take a category (stored as "Any").
- Travel fee: pros who travel set a flat $35–$55 (`travelFeeCents`); added to the booking only when the pro goes to the student. The $150 cap is on the service price.
- Model Calls can be Open time (`flexible`): startsAt = open-until; each model picks a time from openSlots. Optional photo + Additional information (`about`).
- Owners can Browse & book as customers (requireStudent gives owners a customer profile without the school check).
- Owners' own pro businesses are free: no Join payment, no membership (`isOwnerBusiness` in entry.ts; owner exception in requirePro, the pro layout, Join and liveProWhere). They still need ID + payouts.
- Legal entity: Nearest, 5729 Lebanon Rd #144605, Frisco, Texas 75034 (Terms & Privacy).
- DATABASE SAFETY: never add `.unique()` to a new column on a table that has rows — drizzle-kit push then asks to TRUNCATE the table. Use a `uniqueIndex(...)` in the table's extras instead (applies silently).
- Connections (students): usernames, Connect → Pending → My Connections, Share with a Connection (accepted only). Minors are name-searchable only by same-school students; anyone can use an exact username. Pro share links: usenearest.com/pro-<slug> (public page `app/[handle]`). See `src/lib/connections.ts`.
- Problem reports: `ProblemReporter` (root layout) catches errors, screenshots the screen (html-to-image), shows a one-tap popup → `/api/report` saves to `problem_reports` and emails support@usenearest.com with the screenshot. `app/error.tsx` + `app/global-error.tsx` cover pages that fail to load. Admin → Problem reports.
- Professional ID check is Nearest's own (driver's license/state ID + live selfie → Verification Queue → approveProId). No Stripe Identity screens. Payout setup pre-fills website/product/category/name/DOB/phone (`src/lib/stripe-connect.ts`) so Stripe only asks what the law requires.
- No Clerk UI components (no "Secured by Clerk"): sign-in is `src/components/NearestSignIn.tsx` (password, email code, new-device code, forgot password) and sign-up is `StudentSignUpForm` / `ProSignUpForm`, all on Clerk's hooks. Keep it that way.
- Sign-in IDs: a Clerk user we haven't seen is linked to the existing Nearest account with the same VERIFIED email (`relinkByEmail` in `src/lib/viewer.ts`) — needed when switching Clerk test → live keys.
- Student price cap: no service or Model Call over $150 (`src/lib/pricing.ts`). Enforced when saving, at booking (on the total), and hidden from student search/profiles. Any future add-ons must count toward the same $150 total.
- Professional entry: pay at registration, no trial. FIRST_IN $10 (hard cap 750 via `entry_counters`), then admin-controlled NEXT_ENTRY_OPEN with PRO_STUDENT $15 (+ one registered student) or GENERAL $20. Rate locked on the account (`entry_type`, `monthly_rate_cents`). See `docs/ENTRY.md` and `src/lib/entry.ts`. Never use "Founding" or "30 days free" in anything people see.
- Schools: `npm run schools:import -- --state TX` (or no flag for every state; `--dry-run` to preview) loads colleges, universities, community colleges and trade schools (IPEDS) plus public high schools (CCD) from the Urban Institute Education Data API, with county names from the Census API. Idempotent (skips same name + city). Private high schools aren't in those directories — add via Admin → Schools. The student picker loads step by step from `/api/places`, never the full list.
- Markets: every county has a `state` and a `market` (DFW, Houston, Austin, San Antonio, Waco, West Texas, El Paso, Other Texas, Other <State>). County and city names are unique per state, enforced in `src/lib/places.ts` (no DB constraint). Add places by State + ZIP (Zippopotam + FCC census area API). Student "All" = their own market. All 254 TX counties are in `src/db/texas-counties.ts`. Times are still America/Chicago everywhere; per-market time zones are needed before launching outside Central time (El Paso is Mountain).
- Phase 7 (social links, Terms/Privacy, favorites, notifications inbox, Near Me distance, yearly re-verification, `npm run db:cleanup`) is built. See `docs/PHASE-7.md`. In-app notifications go through `inbox()` in `src/lib/inbox.ts`.
- Phase 6 (emails, reminders, 12-month price step-up, Coverage and Marketing dashboards) is built. See `docs/PHASE-6.md`, and `docs/LAUNCH.md` for go-live steps. All email goes through `src/lib/notify.ts`/`sendEmail()`, and a failed email must never block an action.
- Phase 5 (enforcement, appeals, partner Sales Track, hourly cron) is built. See `docs/PHASE-5.md`. Never add a UNIQUE constraint to an existing table with rows: drizzle-kit push will prompt to truncate it. Enforce in code instead.
- Phase 4 (appointment day: address unlock, 100-ft check-in, messaging, finish flow, reviews, no-shows, incidents) is built. See `docs/PHASE-4.md`. Rules live in `src/lib/appointment.ts`.
- Phase 3B (booking, payments, membership, Stripe Identity, payouts) is built. See `docs/PHASE-3B.md`.
- All money logic lives in `src/lib/bookings.ts` and `src/lib/credits.ts`. Money is integer cents. Never refund cash; cancellations create `credits` rows.
- Booking availability is computed only by `openSlots()` in `src/lib/availability.ts`. Never duplicate those rules.
- Student ID photos live only in `student_id_docs`, are served only through the logged admin route, and are deleted on every decision. Never display or export them anywhere else.
- Student pages start with `requireVerifiedStudent()` (`src/lib/student.ts`). Students only ever see pros matched by `liveProWhere()` (`src/lib/search.ts`).
- Photos upload straight from the browser to Vercel Blob through `/api/blob`. Never accept file bodies in server actions.
- Pro pages and actions start with `requirePro()` (`src/lib/pro.ts`). Admin ones start with `requireAdmin()`.
- Chicago time helpers live in `src/lib/time.ts`. Always store UTC and convert with `chicagoToUtc`.

## Working rules

- Build only the current phase in `/docs`. If something from a later phase seems needed, stop and ask.
- Make only the change requested. Never touch unrelated files or features.
- Always give complete files, never partial snippets.
- Run `npm run build` and fix every error before saying a task is done.
- This machine runs Windows PowerShell:
  - Create folders with `New-Item -ItemType Directory -Force` before writing into them.
  - Use `Set-Content -Encoding UTF8` (never without the encoding flag).
  - Deploy with: `npm run build; git add .; git commit -m "..."; git push; npx vercel --prod`
- Keep secrets in `.env.local` and Vercel environment variables. Never commit them.

- Payouts are NOT required to go live (liveProWhere/proBlockers). When a pro without payouts is paid (release or forfeited deposit), the booking completes and `bookings.payout_owed_cents` holds the amount; `payOwedToPro()` sends it when payouts turn on (webhook account.updated + syncProStripe). Earnings shows "$X waiting for you".
- Owner view on customer Explore lists hidden pros with reasons (`src/lib/live-check.ts` — keep in step with liveProWhere).
