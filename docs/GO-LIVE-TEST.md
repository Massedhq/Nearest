# Go-Live Test Script (real money, real accounts)

Do this **after** Admin → Launch readiness shows every row green (grey rows checked by hand).

Use **three devices or browsers**, or one normal window plus two **Incognito** windows, so the owner, professional and student are never signed in at the same time in one browser.

Use a **real debit or credit card** you own. Every payment below is small and can be refunded from Stripe afterwards.

## A. Owner (normal window)

1. Go to usenearest.com/admin/sign-in and sign in with your email code. **Expect:** Choose workspace or Command Center, with your name at the bottom-left.
2. **First In → + Invite professional**, using a second email you control, city Frisco, category Lashes. **Expect:** an `FI-FRS-…` code, and the invitation email arrives from hello@usenearest.com.
3. **My profile:** check your name, set your partner code (for example AVY), then **Connect payout account** with your real bank or debit card. **Expect:** "Connected: [Bank] ••••1234."

## B. Professional (Incognito window 1)

1. Open the invitation link from the email. **Expect:** FIRST IN INVITATION, $10/month for your first 12 months.
2. Tap **Accept invitation**, sign up with the invited email, enter the code, then your legal name and birthday.
3. **Join Nearest → Pay $10 and continue.** Use your real card. **Expect:** you're charged $10 now, then you land in setup. Admin → First In shows 1 / 750.
4. Finish setup:
   - profile and photo
   - one service at $150 or less (try typing 333 and confirm the box refuses it)
   - location
   - hours
   - communication
   - optional portfolio
   - **Submit for review**
5. **My Business → Membership, ID & payouts.** **Expect:** Membership shows First In $10 (Active). Then **Verify my identity** (real ID and selfie) and **Set up payouts** (your real bank or debit card).

## C. Owner approves (normal window)

1. **Verification Queue:** approve the professional's profile (and license, if asked). **Expect:** the pro's bell shows "You're approved."
2. **Professionals:** the pro shows Entry "First In · $10," Payment "Paid," and Registered today.

## D. Student (Incognito window 2)

1. Go to usenearest.com, tap **Create account**, and enter details. If you enter an age of 13–17, the parent consent box appears.
2. Enter the email code. **Expect:** it goes straight to "Where do you go to school?"
3. Pick State → County → City, then type the school. Choose a graduation year.
4. On **Get Verified**, tap **Take selfie**. **Expect:** your camera opens in the page. Capture the ID and the selfie, then submit.
5. On **Owner → Verification Queue**, approve the student. **Expect:** the student's bell shows "You're a Verified Student."
6. The student searches and finds the pro ("All DFW"), opens the profile, and books a time 24+ hours out. They pay with a real card at the lowest-priced service.
   **Expect:** a confirmation email to both, and the address shown as locked.

## E. Appointment day

The quickest way to test this is to book a same-day opening, or have the pro add an **Available Today** time for right now.

1. **Student:** after 12:00 AM on the day, the address shows. Within 60 minutes of the start, tap **CHECK IN** at the location.
2. **Pro:** sees "Your client has checked in," then taps **Start service**, then **Finish service**.
3. **Student:** Finish your appointment → Yes → photo (optional) → 5★ review → **Release**. **Expect:** "All done." The pro's Stripe Express dashboard shows the payment, minus Stripe's fee.

## F. Money check (Stripe dashboard, live mode)

- **Payments:** $10 pro entry, and the student's booking.
- **Connect → Accounts:** the pro, and you as partner.
- **Transfers:** the released payment went to the pro.
- Refund your own test payments from each payment's page if you like.

## G. Clean up before promoting

In the terminal, run `npm run db:cleanup` and type `DELETE TEST DATA`. Owners, settings, cities and schools stay. Then open **Launch readiness** one last time.
