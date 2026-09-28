# Professional Entry (First In → Next Entry)

Nearest is live. Professionals pay at registration, with no free trial, then continue straight into the existing onboarding.

## Flow

1. Sign up (Clerk), then name and birthday (`/pro/onboarding`).
2. **Join** (`/pro/join`): pay the entry rate. The first month is charged now by Stripe Checkout, with no trial.
3. On payment (the return page and the `checkout.session.completed` webhook both call `finalizeEntry`, which runs once), the account gets its entry locked:
   - `entry_type`, `monthly_rate_cents` and `entry_paid_at` are saved
   - the membership is saved
   - the professional goes on to onboarding
4. Every professional page sends unpaid professionals to `/pro/join` (`requirePro` and the pro layout). Older accounts with a live membership count as paid.

## Entry types (locked to the account for the first 12 months)

| entry_type | Monthly | Available when |
|---|---|---|
| FIRST_IN | $11 (members who joined at $10 keep $10) | `FIRST_IN_OPEN`, capped at 750 paid |
| PRO_STUDENT | $16 | `NEXT_ENTRY_OPEN`. Requires registering one student, stored in `pro_student_links`. The student is emailed after payment and linked when they sign up with that email. |
| GENERAL | $21 | `NEXT_ENTRY_OPEN` |

After the first 12 months, memberships step up to the standard rate ($30), as before.

## Enrollment state

Stored in `platform_settings` under key `entry.state`, and changed in **Admin → First In → Enrollment phase** by owners (logged):

- `FIRST_IN_OPEN`: only $11 First In.
- `FIRST_IN_CLOSED`: enrollment is paused; the Join screen says so.
- `NEXT_ENTRY_OPEN`: the $16 and $21 options side by side.

## The 750 hard limit (`src/lib/entry.ts`)

- One atomic counter row (`entry_counters.first_in`) is incremented only while it's under capacity (`growth.founding_capacity`, default 750). Two people can never get the last seat. Tested with 10 simultaneous payers against a capacity of 3: exactly 3 got seats.
- A seat is **held for 35 minutes** while someone pays. The Stripe Checkout **expires at 31 minutes**, so a payment can't finish after its hold. Unfinished holds are released by the 15-minute scheduled check (`releaseExpiredHolds`).
- Only successful payments count as registered. When the last seat is paid, the state switches to `FIRST_IN_CLOSED` automatically.

## Invitations

New codes use `FI-CITY-0000`, and older `FND-` codes keep working until they're used or expire. Invitations only work while First In is open. The invitation page and email say "First In" with "$11/month for your first 12 months."
