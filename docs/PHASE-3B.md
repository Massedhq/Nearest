# Phase 3B — Booking, Payments, Membership, ID Checks and Payouts

**Goal:** a verified student books and pays for a service or a model call. The payment is held, then released to the pro after the appointment. Pros pay a monthly membership, verify their identity, and connect a bank account.

All money runs through **Stripe**. Card details never touch Nearest's servers (Stripe Checkout).

## Going live as a pro

A pro appears to students only when **all** of these are true (see `liveProWhere` in `src/lib/search.ts`):

- The profile is approved by an owner.
- The membership is `trialing` or `active`.
- Identity is `verified` (Stripe Identity: government ID + live selfie).
- Payouts are enabled (Stripe Connect Express account).
- Vacation mode is off.

Pros handle all three Stripe steps at **My Business → Membership, ID & payouts** (`/pro/payments`).

- **Membership:** Checkout subscription at the cohort price. It finds or creates the price by lookup key `nearest_pro_founding_10` / `nearest_pro_second_20` / `nearest_pro_standard_30`. There are 30 free days on the first membership only. **Manage billing** opens Stripe's customer portal.
- **12-month step-up (not automated yet):** moving Founding/Second pros to the standard price after 12 months is a later task (Stripe subscription schedules).

## Booking rules (`src/lib/availability.ts`)

- Starts every 30 minutes inside the pro's hours, where the whole service fits.
- **Future days:** at least `booking.advance_hours` (24) from now.
- **Today:** only times the pro posted in Available Today, only before `booking.same_day_cutoff` (12:00 PM), and at least `booking.same_day_min_notice_hours` (4) from now.
- Removed if the time overlaps a confirmed booking, an unexpired payment hold, a blocked time or a model call. Vacation mode means no times.
- The time is re-checked when the student pays, plus a double-booking guard after the booking row is created.
- Bookings only work while **Admin → Marketplace status → Bookings** is **Active**.

## Payment (`src/app/book-actions.ts`, `src/lib/bookings.ts`)

1. The student reviews the price. Credit is applied first (credit with that pro, then general Nearest credit), and the card is never charged under $0.50.
2. A `pending_payment` booking holds the time for 31 minutes. Stripe Checkout requires at least 30.
3. On return from Stripe (and again via the webhook), `confirmFromCheckout` confirms it. It records the charge and Stripe's fee, uses up the credits once, and takes a model-call spot.
4. If credit covers everything, the booking confirms with no Stripe step.
5. **Release:** after the start time, the student taps **Release payment**. That transfers the price minus Stripe's fee to the pro's connected account, and the booking becomes `completed`.

## Cancellations

- **Student, 24+ hours ahead:** the full value comes back as credit with that pro (general credit that was used comes back as general).
- **Student, inside 24 hours:** the deposit (`appt.deposit_cents`, $5) is forfeited and transferred to the pro if they have payouts set up. The rest comes back as credit with that pro.
- **Pro cancels:** the full value comes back as **general** Nearest credit (usable with anyone).
- **No cash refunds.** Credits never expire.

## Webhook (`/api/stripe/webhook`)

This handles `checkout.session.completed`, `customer.subscription.updated/deleted`, `identity.verification_session.verified/requires_input` and `account.updated`. It needs `STRIPE_WEBHOOK_SECRET`. Pages also sync with Stripe when opened, so everything works locally without it.

**When usenearest.com is live:** in Stripe, go to **Developers → Webhooks → Add endpoint** → `https://usenearest.com/api/stripe/webhook`. Select the events above, turn on **Listen to events on Connected accounts** for `account.updated`, and copy the signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`.

## Admin

- **Bookings:** counts by status and the last 200 bookings.
- **Money:** memberships (MRR, paying, trial, by cohort) kept separate from booking money (card payments, held, released, fees) and outstanding student credits.

## New environment variables

- `STRIPE_SECRET_KEY` (required; `sk_test_…` while testing)
- `STRIPE_WEBHOOK_SECRET` (for production)

## Done means

- [ ] Stripe test mode: Connect, Identity, and Customer portal (Settings → Billing → Customer portal → Save) are turned on.
- [ ] A pro starts the free month, completes Identity (test mode offers "Verified" buttons), and finishes payouts (use Stripe's test data). They then show up for students.
- [ ] With Bookings turned on, a student picks a time and pays with card `4242 4242 4242 4242`, then lands on "You're Booked".
- [ ] The booked time disappears for other students.
- [ ] Cancelling 24h+ ahead gives full credit. The next booking with that pro uses it automatically.
- [ ] A pro cancelling gives general credit.
- [ ] After the start time, Release payment marks it completed, and Admin → Money shows it released.
