# Phase 4 — Appointment Day

## Where it happens (`src/app/book-actions.ts → resolveLocation`)

- Each booking snapshots its location: the pro's address (come-to-me), or the student's address (the pro travels), or the student's choice when the pro offers both.
- Addresses are turned into map coordinates with the free U.S. Census geocoder (`src/lib/geo.ts`, no key).
- A pro's address is mapped when they save Location. If the lookup fails, check-in still works but isn't location-compared.

## Address unlock

A booked student (and, for travel bookings, the pro) sees the address from **12:00 AM Chicago time on the appointment day**. Before that it shows "Address locked".

## Check-in (`checkIn` in `src/lib/appointment.ts`)

- Opens 60 minutes before the start and closes at the end.
- The phone's GPS is compared to the appointment location, and passes within `appt.checkin_radius_ft` (100 ft).
- Because phone GPS has an accuracy radius, a reading also counts when its accuracy is ≤ 200 ft and that radius overlaps the 100 ft zone.
- Distance and accuracy are stored for Incident Review.
- The pro sees "Your client has checked in" on their dashboard and on the appointment.

## Pro controls (`/pro/appointments/[id]`)

- **Start service**, then **Finish service & send completion steps**.
- **Mark customer no-show:** only after `appt.grace_minutes` (15), and only if the student didn't check in.
  - The $5 deposit transfers to the pro, and the rest becomes the student's credit with that pro.
  - It adds 1 to the student's `no_show_count`. Enforcement (5 → 90-day suspension) is Phase 5.
- **Cancel:** the student gets full general credit (from Phase 3B).

## Student finish flow (`/bookings/[id]/finish`)

These unlock once the pro taps Finish, or once the scheduled end time passes.

1. **Confirm the service** was completed, or report an issue.
2. **Optional photo.** A separate Yes/No controls whether it's added to the pro's portfolio as a "Nearest Booking" photo.
3. **Review:** 1–5 stars plus optional text. One per booking, labeled "Verified Booking".
4. **Release payment:** transfers to the pro.

## Messaging

- One thread per booking, reachable from the Messages tab (both sides), the appointment, and the student's booking page.
- New messages are checked every 8 seconds while open. There are quick replies, and the thread closes `appt.messaging_days` (90) after the appointment.
- Only the two people on the booking can read it.

## Report a problem (`/bookings/[id]/problem`)

- Reason, details, and a location re-check. It's refused if the student isn't at the location.
- It lands in **Admin → Incident Review** with the check-in and complaint GPS records.
- **Professional fault confirmed:** full general credit to the student.
- **Not substantiated:** closes the incident.
- Both decisions are logged. Fines come in Phase 5.

## Reviews

The average rating and count appear in search and on profiles (replacing "New Professional"), with the review list on the profile.

## Done means

- [ ] Booking a travel-mode pro asks for the student's address.
- [ ] On the appointment day, the address appears. Check-in works at the location and is refused far away.
- [ ] The pro sees the checked-in banner, then Start → Finish.
- [ ] The student completes all 4 finish steps. The payment releases, and the review shows on the profile.
- [ ] With "Yes" on the photo, it appears in the pro's portfolio.
- [ ] 15+ minutes after the start with no check-in, the pro can mark a no-show, and the credit and deposit follow the rules.
- [ ] Messages flow both ways and show in both Messages tabs.
- [ ] A problem report reaches Incident Review, and "pro fault" gives the student general credit.
