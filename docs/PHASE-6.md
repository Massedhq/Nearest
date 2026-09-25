# Phase 6 — Launch Features

- **Emails** (`src/lib/email.ts`, `src/lib/notify.ts`, via Resend; skipped silently if `RESEND_API_KEY` isn't set):
  - booking confirmed (student and pro)
  - reminder about 24 hours before (student and pro) and about 2 hours before (student)
  - "finish your appointment" when the pro taps Finish
  - cancellation notices both ways
  - founding invitations
- **Scheduled check every 15 minutes** (`/api/cron/sweep`, `vercel.json`): auto-complete and suspension, then reminders, then price step-ups.
- **12-month price step-up:** `intro_ends_at` = paid billing start + 12 months. After that, Founding and Second memberships switch to the standard price in Stripe, with no proration and nothing for the pro to do.
- **DFW Coverage** (Admin): 11 counties and a starter list of 133 cities, with live pros per city against the target, all pros, verified students, add a city (with counties), and turn cities on or off.
- **Marketing** (Admin): demand without supply, supply without demand, per-city searches, searches that found nothing, bookings, and the top missed searches. Student searches are logged in `search_log`.
- **Launch checklist:** `docs/LAUNCH.md`.
