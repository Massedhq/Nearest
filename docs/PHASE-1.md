# Phase 1 — Foundation

**Goal:** real accounts for all three doors, founding invitations that work end to end, and the admin shell. When Phase 1 is done, an owner can send an invite, a professional can accept it and create an account, a student can sign up with a verified email, and the owner can see all of it in Admin.

**Not in Phase 1:** school or ID verification, pro profiles/services/hours, model calls, search, booking, payments, messaging, check-in, credits, fines. Pages for those show a simple "Coming soon" panel inside the correct layout.

---

## 1. Routes

```
src/app/
  (student)/
    page.tsx                  Welcome                → Main.dc.html
    sign-in/[[...rest]]       Sign in                → G_SignIn.dc.html
    sign-up/                  Create account         → M_Signup.dc.html
    verify-phone/             6-digit code           → G_OTP.dc.html
    home/                     Student home shell     → M_Home.dc.html (Model Calls card + tab bar; content "Coming soon")
  pro/
    page.tsx                  Pro landing + sign in
    invite/[code]/            Founding invitation    → P_Invite.dc.html
    sign-up/                  Pro account            → P_Account.dc.html
    home/                     Pro dashboard shell    → P_Home.dc.html (tab bar; content "Coming soon")
  admin/
    layout.tsx                Sidebar shell          → A_Home.dc.html (sidebar)
    page.tsx                  Command center         → A_Home.dc.html
    founding/                 Founding 750           → A_Founding.dc.html
    settings/                 Rules & status         → A_Settings.dc.html
    team/                     Team & activity log    → A_Team.dc.html
    (all other sidebar links) "Coming soon"
  workspace/                  Owner workspace chooser → G_Workspace.dc.html
  api/…                       Route handlers (.ts)
src/proxy.ts                  Clerk sign-in gate (role checks happen in each layout)
```

**Role gates (server side):**

- `/home` and student pages: role `student`
- `/pro/home`: role `professional`
- `/admin/*`: an `admin_members` row with an active role
- A signed-in user who hits the wrong door is sent to their own door. Owners who are also professionals land on `/workspace`.

---

## 2. Database (Drizzle, `src/db/schema.ts`)

**users**
`id` uuid pk · `clerk_user_id` text unique · `account_type` enum(`student`,`professional`) · `first_name` · `last_name` · `date_of_birth` date · `phone` text · `phone_verified_at` timestamptz · `email` text · `email_verified_at` timestamptz · `status` enum(`active`,`paused`,`suspended`,`deactivated`) default `active` · `created_at` · `updated_at`

**student_profiles**
`user_id` pk/fk · `verification_status` enum(`unverified`,`pending`,`manual_review`,`verified`,`rejected`) default `unverified` · `school_id` nullable · `graduation_year` int nullable · `prefers_text` bool · `wants_asl` bool · `created_at`

**professional_profiles**
`user_id` pk/fk · `business_name` nullable · `cohort` enum(`FOUNDING`,`SECOND`,`STANDARD`) · `invitation_id` fk nullable · `identity_status` enum(`unverified`,`pending`,`verified`,`rejected`) default `unverified` · `searchable` bool default false · `created_at`

**invitations**
`id` uuid pk · `code` text unique (format `FND-FRS-0458`: cohort, city abbreviation, running number) · `name` · `contact` (email or phone) · `city_id` fk · `category` text · `cohort` enum · `status` enum(`invited`,`registered`,`expired`,`declined`,`revoked`) · `expires_at` · `created_by` fk users · `registered_user_id` fk nullable · `created_at`

**admin_members**
`user_id` pk/fk · `role` enum(`OWNER`,`ADMIN`,`MARKETING_ADMIN`,`OPERATIONS_ADMIN`,`SUPPORT`) · `active` bool · `created_at`

**platform_settings**
`key` text pk · `value` jsonb · `updated_by` fk · `updated_at`

**activity_log** (insert only)
`id` bigserial · `actor_user_id` · `action` text · `target_type` · `target_id` · `before` jsonb · `after` jsonb · `created_at`

**counties** `id` · `name` · `market` (default `DFW`)
**cities** `id` · `name` · `abbreviation` (3 letters, used in invite codes) · `active` bool
**city_counties** `city_id` · `county_id` (a city can sit in more than one county)

### Seed data (`src/db/seed.ts`)

- **Counties:** Collin, Dallas, Denton, Ellis, Hunt, Johnson, Kaufman, Parker, Rockwall, Tarrant, Wise
- **Cities:** start with Frisco (FRS), Allen, Plano, McKinney, Little Elm, Aubrey, Arlington, Forney and Alvord, with their counties. The full ~150-city list gets loaded from a CSV later.
- **platform_settings:**
  - `booking.advance_hours` = 24
  - `booking.same_day_cutoff` = "12:00"
  - `booking.same_day_min_notice_hours` = 4
  - `appt.grace_minutes` = 15
  - `appt.checkin_radius_ft` = 100
  - `appt.messaging_days` = 90
  - `appt.deposit_cents` = 500
  - `cancel.cutoff_hours` = 24
  - `enforce.customer_noshow_limit` = 5
  - `enforce.customer_suspension_days` = 90
  - `enforce.fine_cents` = 5000
  - `enforce.fine_due_days` = 7
  - `enforce.pro_incident_limit` = 3
  - `enforce.pro_suspension_days` = 30
  - `enforce.unpaid_fine_termination_days` = 30
  - `growth.founding_capacity` = 750
  - `growth.target_per_city` = 5
  - `growth.invite_expiry_days` = 7
  - `sub.termination_days` = 90
  - `status.pro_registration` = true
  - `status.founding_invitations` = true
  - `status.student_registration` = true
  - `status.bookings` = false
- **Owners:** any sign-in whose email is listed in the `OWNER_EMAILS` environment variable gets an `admin_members` row with role `OWNER` on first sign-in.

---

## 3. Flows

**Student sign-up**

1. Welcome → Create account.
2. Email and password (Clerk).
3. 6-digit code sent by email.
4. First name, last name and date of birth.
5. Create `users` + `student_profiles`.
6. Land on `/home`.

If `status.student_registration` is false, show "Registration is closed right now" instead of the form.

**Founding invitation (sales rep → pro)**

1. In Admin → Founding 750, the owner fills name, contact, city and category, then clicks Generate invitation.
2. This creates an `invitations` row with a code and an expiry of now + `growth.invite_expiry_days`.
3. The owner sees a copyable link `nearest.com/pro/invite/{code}`. Sending it by text or email comes in a later phase.
4. `/pro/invite/{code}` shows the invite card: code, city, expiry date, "30 days free, then $10/month for your first 12 months," and the Accept invitation and Register without an invitation buttons.
5. The invite page rejects expired, revoked or already-used codes.
6. When registered professionals reach `growth.founding_capacity`, or `status.founding_invitations` is false, new founding codes can't be generated and unused ones show "Founding registration is closed."

**Professional sign-up**

1. Legal names, date of birth, mobile, email and password.
2. Verify the 6-digit code sent by email.
3. Create `users` + `professional_profiles`:
   - With a valid code: `cohort = FOUNDING`, and the invitation is marked `registered`.
   - Without a code: the cohort is `SECOND` while fewer than 750 of that cohort exist, otherwise `STANDARD`.
4. If `status.pro_registration` is false and there's no code, show "Registration is closed."
5. Land on `/pro/home`.

**Admin**

- **Command center:** real counts for founding claimed (x / 750), professionals, students, and cities with at least one pro. Cards for things that don't exist yet show "—".
- **Marketplace status:** four switches bound to the `status.*` settings. Each change writes the activity log.
- **Rules & Settings:** a form for every `platform_settings` key, grouped as in the mockup. Only `OWNER` can save. Saving writes the activity log with before and after values.
- **Team:** list of `admin_members` and the latest 100 activity log rows.

---

## 4. PWA basics

- `app/manifest.ts`:
  - name "Nearest"
  - black background and theme color
  - monogram icons at 192 and 512
  - start_url `/home`
- A second manifest scoped to `/pro` with start_url `/pro/home`.
- No offline caching yet.

---

## 5. Done means

- [ ] `npm run build` passes with zero errors.
- [ ] A new student can sign up with a real emailed code and lands on `/home`.
- [ ] A student who opens `/pro/home` or `/admin` is redirected to `/home`.
- [ ] An owner generates an invite. The link opens the invite card. Accepting it creates a FOUNDING professional, and the invite shows Registered in Admin.
- [ ] The same code can't be used twice, and an expired code shows an expired message.
- [ ] Turning off Student Registration immediately blocks new student sign-ups.
- [ ] Changing a setting shows up in the activity log with before and after values.
- [ ] An owner who is also a professional sees the workspace chooser.
- [ ] Every Phase 1 page visually matches its mockup on a 390px-wide phone, and admin matches at 1440px.
