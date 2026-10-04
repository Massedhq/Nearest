# Turning on the AI recruiter (one time)

The AI recruiter needs two connections. Until both are set, replies go to **Outreach → Needs review** for a person.

## 1. The AI key
1. Go to https://console.anthropic.com → **API Keys** → **Create key**. Copy it (starts with `sk-ant-`).
2. Add a payment method under **Billing** (each AI reply costs a few cents).
3. Vercel → Nearest → **Settings → Environment Variables** → add `ANTHROPIC_API_KEY` = the key (Production + Preview) → Save.

## 2. Incoming email (info@usenearest.com → Nearest)
1. Resend → **Domains** → usenearest.com → turn on **Receiving** and add the MX record it shows at your domain host.
   - If you already use usenearest.com for Google Workspace / Zoho mail, DON'T replace your MX record. Instead keep info@ in your mail provider and set a forwarding rule from info@usenearest.com to the Resend receiving address shown in Resend → Receiving.
2. Resend → **Webhooks** → **Add webhook**:
   - URL: `https://www.usenearest.com/api/inbound/email`
   - Event: **email.received**
3. Open the new webhook → copy its **Signing secret** (starts with `whsec_`).
4. Vercel → Environment Variables → add `RESEND_INBOUND_SECRET` = that secret (Production + Preview) → Save.
5. Vercel → Deployments → top one → ⋯ → **Redeploy**.

## 3. Check it
Admin → Outreach → **AI recruiter**: all three should show ✓. Add yourself as a prospect, start a batch of 1, reply to the email from your phone ("How much is it?") — within a minute you'll get the AI's answer and see the thread on the prospect page.
