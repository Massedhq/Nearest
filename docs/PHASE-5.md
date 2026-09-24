# Phase 5 — Enforcement, Appeals and the Partner Sales Track

## Students (`src/lib/enforcement.ts`)

- **No-shows:** each no-show adds 1 to `no_show_count`. The one that goes past `enforce.customer_noshow_limit` (the 6th, with the limit at 5) suspends booking for `enforce.customer_suspension_days` (90).
- **Left without finishing:** when the pro tapped Finish and the student hasn't completed the steps `enforce.completion_hours` (24) after the end time, the hourly check releases payment to the pro and suspends the student's booking for 90 days. Bookings with an open incident are skipped for an admin to decide.
- **While suspended:** the student sees "Booking temporarily unavailable" with the end date and **Request review**. They can still use Account, Messages, Bookings and Credits, but can't book.

## Professionals

- **Confirmed fault** (Admin → Incident Review): the student gets full general credit, and the pro gets a `enforce.fine_cents` ($50) fine due in `enforce.fine_due_days` (7).
- Every `enforce.pro_incident_limit`th (3rd) confirmed incident suspends the pro for `enforce.pro_suspension_days` (30).
- **Hidden from students** while suspended or while any fine is past due.
- Pros pay fines in the app (Stripe Checkout) from **My Business → Account status**, which also shows the incident count and lets them request a review.
- Fines unpaid for `enforce.unpaid_fine_termination_days` (30) are flagged on Admin → Enforcement as eligible for removal. **Nothing is deleted automatically.**

## Appeals

- Students (suspension) and pros (fine or suspension) can request a review. Only one open review per kind.
- **Admin → Appeals:** Uphold, or Overturn (lifts the suspension or waives the fine). A reason is required, and every decision is logged.

## Admin → Enforcement

Outstanding and past-due fines (waive), suspended pros (lift), suspended students (lift), no-show counts (reverse one, which recalculates the suspension), and **Run checks now**.

## Hourly check

`/api/cron/sweep` runs on Vercel Cron every hour (`vercel.json`). It needs `CRON_SECRET` in Vercel; the installer creates one.

## Partner Sales Track (`src/lib/partner.ts`, Admin → Sales Track)

- **Partners:** the active OWNER admins. Each gets a code (AVY, KISSES, KEE) and a link, `/pro/sign-up?ref=CODE`. A pro is credited to the partner whose invitation they used, or whose link they signed up with.
- **Pros #1–3,000** (pool size − Nearest block): their membership payments are split equally among the partners.
- **Pros #3,001–3,500:** their payments go to Nearest.
- **Pros #3,501+:** the partner who brought them in earns $8 / $17 / $26 per $10 / $20 / $30 payment, and Nearest keeps $2 / $3 / $4. Pros with no partner earn Nearest the full amount.
- Only real payments count (Stripe `invoice.paid`, or **Sync payments from Stripe**). Free-trial months earn nothing.
- **Visibility:** the main owner (`MAIN_OWNER_EMAIL`, else the first owner) sees every partner and Nearest's share, approves payouts, and marks them paid. Other partners see the group total and only their own earnings and payouts.
- At full scale, verified in tests: $52,500 pool → $17,500 each, and $10,000 to Nearest.

## New environment variables

- `CRON_SECRET`: the installer creates it. Add the same value in Vercel.
- `MAIN_OWNER_EMAIL`: the installer sets it to avy@usenearest.com. Add it in Vercel.

**Stripe webhook:** also select `invoice.paid`.
