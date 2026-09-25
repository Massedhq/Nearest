# Nearest — Launch Checklist

Do these in order. Everything before step 8 can be done while you're still testing.

## 1. Replace the keys that were shared in chat
- **Clerk:** API keys → roll the Secret key.
- **Neon:** Roles → neondb_owner → Reset password.
- Put the new values in `.env.local` **and** Vercel → Settings → Environment Variables. Redeploy.

## 2. Domain padlock (usenearest.com)
- Vercel → nearest → Settings → Domains → add `usenearest.com` and `www.usenearest.com` (redirect www → usenearest.com).
- At your domain provider, add exactly the records Vercel shows, usually an A record for `@` and a CNAME for `www`. Delete any old "parking" A record.
- Wait for **Valid Configuration**. The padlock follows automatically.

## 3. Email (Resend)
- resend.com → **Domains → Add** `usenearest.com` → add the DNS records it shows (SPF, DKIM) at your domain provider → **Verify**.
- **API Keys → Create**. Add to Vercel and `.env.local`:
  - `RESEND_API_KEY=re_…`
  - `EMAIL_FROM=Nearest <hello@usenearest.com>`
  - `APP_URL=https://usenearest.com`

## 4. Clerk live mode
- Clerk dashboard → switch to **Production** → Create production instance → domain `usenearest.com`.
- Add the DNS records Clerk lists (several CNAMEs) and wait for them to verify.
- Repeat your settings in Production:
  - Email **on**, verified with an **email code**
  - Phone **off**, Username **off**
  - Password **on**
  - Social logins your choice
- Copy the **live** keys (`pk_live_…`, `sk_live_…`) into Vercel only. Keep `pk_test_`/`sk_test_` in `.env.local` for testing.
- **Production users are separate from test users.** Kisses, Kee and you must be created again under Production → Users (or sign up fresh).

## 5. Stripe live mode
- Finish **Activate account** (business details, bank account for Nearest's membership revenue).
- **Connect:** complete the live platform profile (Marketplace, Express), plus branding.
- **Identity:** make sure it's enabled in live mode.
- **Settings → Billing → Customer portal → Save** (live mode has its own settings).
- **Developers → Webhooks → Add endpoint** → `https://usenearest.com/api/stripe/webhook`.
  - **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `identity.verification_session.verified`, `identity.verification_session.requires_input`, `account.updated`.
  - Turn on **Listen to events on Connected accounts** (for `account.updated`).
  - Copy the signing secret → Vercel `STRIPE_WEBHOOK_SECRET`.
- Put the **live** secret key (`sk_live_…`) in Vercel as `STRIPE_SECRET_KEY`.

## 6. Vercel environment variables (Production)
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `OWNER_EMAILS`, `MAIN_OWNER_EMAIL`
- `BLOB_READ_WRITE_TOKEN` (added automatically by the Blob store)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`
- `CRON_SECRET`

Redeploy after changing any of them.

## 7. Legal review before real money
- Terms of Service and Privacy Policy pages.
- Students under 18: guardian consent, and whether minors can pay directly.
- The credit-only refund policy under Texas consumer law.
- Storing student ID photos (currently deleted right after review).
- TDLR license rules per category (Admin → Marketplace).

## 8. Clean start
- Remove test accounts and test bookings from the database before launch. Ask Claude for a one-time cleanup script, or create a fresh Neon branch for production.

## 9. Open the doors (Admin → Command Center → Marketplace status)
- Professional Registration, Founding Invitations and Student Registration: **Open**.
- Bookings: **Active**.

## 10. Smoke test on usenearest.com (real card, small amount)
- [ ] An owner signs in. Kisses and Kee sign in.
- [ ] Invite → a pro registers → setup → approved → membership (free month), ID and payouts done → appears in search.
- [ ] A student signs up → school → ID → verified by an admin.
- [ ] Book → pay → confirmation email → reminder emails → check in → finish steps → payment released → the pro's Stripe balance shows it.
- [ ] Admin → Money and Sales Track show the activity.
