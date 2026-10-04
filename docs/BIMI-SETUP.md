# Nearest logo in inboxes (BIMI)

`public/bimi-logo.svg` is the official Nearest monogram traced into BIMI's required format
(SVG Tiny PS: version 1.2, baseProfile tiny-ps, <title>, square, solid background, no images/scripts, < 32 KB).
It is served publicly at **https://www.usenearest.com/bimi-logo.svg**.

BIMI works per **domain**, so one logo + one DNS record covers **every** @usenearest.com sender — Avy, Kisses,
Lakeesha, Kee, every partner, outreach emails, broadcasts and Nearest's notifications.

## DNS records (at your DNS host)
1. **DMARC must be enforced** (BIMI is ignored with p=none). Record `_dmarc.usenearest.com` (TXT), e.g.:
   `v=DMARC1; p=quarantine; rua=mailto:dmarc@usenearest.com; adkim=r; aspf=r`
   Only switch to quarantine after SPF + DKIM pass for BOTH Zoho and Resend (check a few days of DMARC reports first),
   or legitimate mail can land in spam.
2. **BIMI record** `default._bimi.usenearest.com` (TXT):
   `v=BIMI1; l=https://www.usenearest.com/bimi-logo.svg; a=;`

## Where it shows
- **Without a certificate (free):** Yahoo Mail, AOL, Fastmail and some others.
- **Gmail and Apple Mail** also require a paid Verified Mark Certificate (VMC, needs a registered trademark) or
  Common Mark Certificate (CMC). When you buy one, put its URL in the `a=` part of the BIMI record.

Check it any time at https://bimigroup.org/bimi-generator/ (BIMI Inspector).
