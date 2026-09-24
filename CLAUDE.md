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
