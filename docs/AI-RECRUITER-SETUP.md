# Turning on the AI recruiter (one time)

Until both connections are set, replies go to **Outreach → Needs review** (or aren't seen) — nothing breaks.

## 1. Replies come back to Nearest — reply.usenearest.com (works with Zoho's free plan)
Outreach emails will say "reply to info@reply.usenearest.com". Only the `reply.` part of your domain goes to Resend;
avy@usenearest.com and all your Zoho mail are untouched.

1. **Resend → Domains → Add domain** → type `reply.usenearest.com` → choose the same region as your current domain.
2. On that domain's page, turn on **Receiving**. Resend shows DNS records to add (an **MX** record for `reply`, plus the verification records).
3. **Where your DNS lives** (the place you added usenearest.com's records before — Vercel, GoDaddy, Namecheap, Cloudflare…):
   add exactly the records Resend shows. They are all for **`reply`** — do NOT change the MX records for `usenearest.com` (those are Zoho's).
4. Back in Resend, click **Verify**. Wait until it says Verified (a few minutes, sometimes up to an hour).
5. **Resend → Webhooks → Add webhook**
   - URL: `https://www.usenearest.com/api/inbound/email`
   - Event: **email.received**
   - Save → open it → copy the **Signing secret** (`whsec_…`).
6. **Vercel → Nearest → Settings → Environment Variables** (Production + Preview), add:
   - `OUTREACH_REPLY_TO` = `info@reply.usenearest.com`
   - `RESEND_INBOUND_SECRET` = the signing secret
7. Vercel → **Deployments** → top one → ⋯ → **Redeploy**.

## 2. The AI key
1. https://console.anthropic.com → **API Keys** → **Create key** (starts with `sk-ant-`). Add a payment method under **Billing** — each AI reply costs a few cents.
2. Vercel → Environment Variables → add `ANTHROPIC_API_KEY` = the key (Production + Preview) → **Redeploy**.

## 3. Check it
Admin → Outreach → **AI recruiter**: all three show ✓ and the reply address reads info@reply.usenearest.com.
Add yourself as a prospect (a personal email), start a batch of 1 in **Queue**, then reply to that email ("How much is it?").
Within a minute it appears in **Conversations** — with the AI's answer once the AI key is in.

Note: replying to an "Email me a test" message won't show up — tests aren't tied to a prospect.
