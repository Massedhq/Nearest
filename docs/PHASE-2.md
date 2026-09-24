# Phase 2 — The Professional Side

**Goal:** a founding pro can build a complete business profile, submit it, and get approved by an owner. Once approved, they can post Available Today openings, create Model Calls and manage their calendar. Owners can verify profiles and licenses, see every pro, manage the category catalog, and email invitations.

**Not in Phase 2:** identity verification by ID and selfie, the membership charge, student search and booking. These are Phase 3. Model calls and openings are stored now and appear to students in Phase 3.

## Pro setup (`/pro/setup/*`)

The steps run in order. Each saves and moves to the next; with `?edit=1` a step saves and stays put, which is how My Business edits work.

1. **Profile:** name, about, years of experience, photo or logo (Vercel Blob), Instagram/TikTok/website, and whether to show the Instagram link.
2. **Services:** choose categories, then name, price and minutes for each service. Suggested services come from the admin catalog.
3. **License:** only appears if a chosen category has `license_required`. Type, number, state and expiration → `pending` until an admin marks it.
4. **Location:** city, ZIP, private address, come-to-me / travel / both, and travel radius.
5. **Hours:** regular weekly hours, plus optional after-school weekdays.
6. **Communication:** languages, text-based communication, ASL level (None / Basic / Conversational / Fluent).
7. **Portfolio:** photo uploads (optional). Star up to 3 as featured.
8. **Review:** the student-facing card preview and a checklist, then Submit for review → `submitted`.

## Pro tools

- **Available Today** (`/pro/today`): 30-minute slots. Closes at `booking.same_day_cutoff`, and each slot must start at least `booking.same_day_min_notice_hours` from now. Approved pros only; blocked in vacation mode.
- **Model Calls** (`/pro/model-calls`, `/new`): service (from the pro's menu), date, time, model price, spots, length, requirements and description. Approved pros only. Can be cancelled.
- **Calendar** (`/pro/calendar`): weekly hours, blocked time (add/remove) and vacation mode.
- **My Business:** links to every edit screen and the preview.

## Admin

- **Verification Queue:** licenses (Verified / Can't verify) and submitted profiles (Approve & go live / Request changes with a note). Every decision is logged.
- **Professionals:** everyone with their status, cohort, services count and ASL level.
- **Marketplace:** categories (license required on/off, active on/off), and adding categories and suggested services. Owner only.
- **Founding 750:** new invites are emailed automatically through Resend when `RESEND_API_KEY` is set. There's an Email button to re-send.

## Pricing rule (updated)

- With a founding invite → `FOUNDING` ($10/month for 12 months).
- Without one → `SECOND` ($20/month for 12 months) until `growth.second_cohort_end` (3,500) professionals exist, then `STANDARD`.

## New environment variables

- `BLOB_READ_WRITE_TOKEN`: added automatically in Vercel when the Blob store is connected. Copy it into `.env.local` for local uploads.
- `RESEND_API_KEY` (optional): invites send only when this is set.
- `EMAIL_FROM` (optional): defaults to `Nearest <invites@usenearest.com>`. The domain must be verified in Resend.

## Done means

- [ ] A new pro sees "Set up your business" with a progress bar and can finish every step.
- [ ] Choosing Lashes adds the License step. Choosing only Braids doesn't.
- [ ] Profile photo and portfolio uploads show up on the preview card.
- [ ] Submitting sends the profile to Admin → Verification Queue, and Approve makes it Approved.
- [ ] Request changes shows the note on the pro's dashboard, and they can resubmit.
- [ ] Before approval, Available Today and Create a model call are locked.
- [ ] After 12:00 PM Chicago time, Available Today says same-day booking is closed.
- [ ] A model call can be created and cancelled.
- [ ] Vacation mode toggles and clears openings.
- [ ] An invite to an email address arrives by email (once Resend is set up).
