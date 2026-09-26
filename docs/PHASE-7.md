# Phase 7 — Finishing Touches

- **Social links:** a pro's Instagram, TikTok and website appear as icons on their profile and open their page in a new tab. There's no importing.
- **Terms of Service and Privacy Policy** (`/terms`, `/privacy`, public). The content reflects how Nearest actually works; sections marked **DRAFT** are for the attorney. Linked from the welcome screen, sign-up and Account.
- **Favorites:** a heart on every pro (search results and profile), and Account → Favorites (only live pros are listed).
- **Notifications inbox (the bell):**
  - student at `/notifications`, pro at `/pro/notifications`, with an unread dot
  - covers bookings, reminders, finish steps, cancellations and credit, messages (one per conversation until read), verification results, approvals, fines and review decisions
- **Near Me:** asks the phone's location once and keeps a rounded copy (~100 m) in a 1-day cookie on the device (never stored by Nearest). It shows "X mi away" and sorts nearest first. Travel-only pros show "Travels to you".
- **Yearly re-verification:** once `reverify_by` (Aug 31) has passed, a verified student is sent back to pick their school and submit a current ID.
- **Test-data cleanup:** `npm run db:cleanup`. It shows what it keeps and removes, and requires typing `DELETE TEST DATA`. It keeps owner logins, settings, counties, cities, schools and categories.
