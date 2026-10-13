# Supporter (educator) endorsements — setup

Nothing to configure: it uses Nearest's existing Neon database, Blob storage and admin sign-in. No Resend/email is needed.

## Database
The installer runs `npx drizzle-kit push`, which only ADDS three new tables (nothing existing changes):
`supporter_invites`, `supporters`, `supporter_events`.

Optional (recommended for the very first run): test on a Neon branch first.
1. Neon console → your project → Branches → Create branch (from main).
2. Copy the branch's connection string.
3. In PowerShell from the nearest folder: `$env:DATABASE_URL="<branch connection string>"; npx drizzle-kit push`
4. If it reports only the three new tables, run the normal installer (it pushes to production).

## Use
Admin → People → Supporters → Invite a supporter → Copy link → share it yourself.
Review → Approve → Publish. The homepage section and /supporters stay hidden/empty until something is Published.

## Never
Don't publish mockup portraits, invented names or made-up statements. Placeholders (labeled "Sample profiles · Concept only", initials only) appear ONLY in local development and Vercel preview deployments — never on the live site.
