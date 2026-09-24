# Phase 3A — Students: Verification, Search and Model Calls

**Goal:** a student signs up, picks their school, submits a school ID photo and a selfie, and is approved by an owner. Once verified, they can search approved professionals, browse Model Calls near me, and open a pro's full profile.

**Not in 3A (coming in 3B):** booking, payment, the $5 protected deposit, pro membership billing, pro ID checks (Stripe Identity) and payouts. Book buttons say "Booking opens soon".

## Student verification (manual review)

1. After name and birthday, students go to `/verify`:
   - They choose their school (grouped by city and type) and graduation year.
   - If their school isn't listed, they can use **Can't find my school?** to request it. They keep going while an owner adds it.
2. `/verify/id`:
   - The student takes a school ID photo and a selfie.
   - Both photos are shrunk on the phone (JPEG, max 1280px) and stored privately in `student_id_docs`.
3. `/verify/status` shows "in review", or, if sent back, the reviewer's reason with a **Try again** button.
4. **Admin → Verification Queue → Students:**
   - The reviewer sees both photos through `/api/admin/id-doc/…`. Admins only, and every view is logged.
   - **Verify student** sets `verified` and `reverify_by` = the next Aug 31.
   - **Send back** requires a reason.
   - Either decision **deletes both photos immediately**.
5. Unverified students can't browse. Every student page sends them to their next verification step.

## Search (`/home`)

- Only pros that are `approved`, `searchable` and not on vacation ever appear.
- **Area:** defaults to the county of the student's school. The chip cycles through the school's city and All DFW.
- **Filters:** search text (business or service name), category, Available Today (openings posted today), After School, Under $25 (any service ≤ $25) and ASL.
- Pros with openings today sort first.
- Pro addresses, phone numbers and emails are never sent to students.

## Model Calls near me (`/model-calls`)

Open, future model calls with spots left, from live pros, using the same area rule.

## Pro profile (`/p/[id]`)

Photo, badges, languages and ASL, how they work, today's openings, portfolio, about, services and prices, model calls, and weekly hours.

## Admin

- **Schools:** every school with an on/off switch, add a school, and students' school requests. **Add school & assign student** fills in the requesting student's school.
- **Students:** name, age, school, class, status and reverify date.

## Done means

- [ ] A new student lands on Where do you go to school? after entering their name.
- [ ] Choosing a school and submitting both photos shows "Verification in review".
- [ ] Before verification, `/home` redirects back into verification.
- [ ] Admin sees the student with both photos. Verify → the student sees Explore. The photos are gone from the database.
- [ ] Send back → the student sees the reason and can try again.
- [ ] A school request appears in Admin → Schools. Adding it assigns it to the student.
- [ ] An approved pro appears in search. A pro on vacation doesn't.
- [ ] The Available Today, After School, Under $25 and ASL filters each work.
- [ ] A model call created by an approved pro appears in Model Calls near me.
