# Nearest — SEO, AI discovery and public resource center

Updated 2026-10-20. Positioning: **Nearest — Student Beauty, Wellness & Self-Care Booking Platform**, for high school,
college, trade school and online students nationwide. Students get discounts on food, clothing, tech and
entertainment; Nearest makes beauty, grooming, wellness and self-care student-priced too. No state is the brand
identity, and no geographic launch schedule is published.

## A. Audit — what was preventing Google from finding Nearest

| Problem (before) | Fix |
|---|---|
| Every path except `/`, `/pro`, `/terms`, `/privacy` redirected anonymous visitors to sign-in (`src/proxy.ts`) — nothing for Google to read | Public resource center in `src/app/(public)`, listed in the proxy's public paths |
| No `robots.txt`, no `sitemap.xml` | `src/app/robots.ts`, `src/app/sitemap.ts` (+ `llms.txt`) |
| No canonical URLs, no structured data; "nearest" is a dictionary word | Canonical on every public page; Organization + WebSite, BreadcrumbList, Article JSON-LD; About page that disambiguates the brand |
| No public content answering real questions | 16 guides, 120 FAQ answers, 7 cornerstone pages |
| Pros outside Nearest's city list can't complete the location step (dropdown of configured cities) | Not changed (signup is preserved). Public city checker shows real status per city and collects opt-in interest; an owner opens a city by adding it in Admin |
| Capacity: spots 6–10 opened automatically after the first 5 | Now 5 per category per city; closed until an owner authorizes ONE additional opening of 5; hard max 10, every state |
| Install banner could cover articles | Hidden on public pages |

Already fine: App Router; apex → `www` 308 redirect on Vercel; HTTPS; Open Graph image exists; service worker and PWA untouched.

## B. What's built

**Public routes** (`src/app/(public)`, server-rendered, anonymous, indexable): `/about-nearest`, `/for-professionals`,
`/student-beauty-services`, `/grow-your-beauty-business`, `/free-business-listing`, `/get-more-clients`,
`/beauty-marketing-resources`, `/resources`, `/resources/[slug]` (16 guides), `/locations` (+ city checker),
`/locations/[state]/[city]` (only cities with a live professional), `/contact`, `/faq` (120 Q&A).

**Guides:** 12 for professionals (clients without ads, free listings, 30-day nail calendar, first 10 clients, flyers,
student event seasons, student pricing, lash clients, booking diagnostic, profile conversion, braid/loc retention,
Google) + 4 for students and parents (saving on self-care, grooming on a budget, prom/homecoming budget planner,
parent's safety guide).

**City status model** (public checker, `src/app/public-actions.ts`):
- **Live for student bookings** — at least one professional there is live (same rule as student search).
- **Open for professionals** — the city is set up in Nearest; per category: First In spots open / additional spots open / closed.
- **Closed at capacity** — every category's spots are taken.
- **Not open yet** — the city isn't in Nearest; opt-in interest is saved (`location_interest`) for Admin → Outreach → City interest.

**Capacity rule** (`src/lib/slots.ts`): `categoryCap()` = 5, or 10 after `authorizeSecondOpening()` (owner, Outreach → Markets,
once per city + category, can't be undone, waitlist notified). `HARD_MAX_PER_CATEGORY = 10`. Tested in two states (18/18).

**Admin:** Outreach → City interest (demand by city and role), Outreach → Growth report (weekly sign-ups, verified students,
partner/rep-referred pros, booking requests, completed bookings, city interest).

**Search Console:** DNS verification recommended; optional `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` env vars add
the HTML-tag method (root layout).

**Content workflow:** edit `src/content/faq.ts` and `src/content/guides-*.ts`; bump `updated` on a guide when you change it
materially; `npm run build`; deploy. Product numbers come from Rules & Settings (`src/lib/public/facts.ts`) — never hardcode them.

## C. Facts needing owner confirmation

1. **Terms §6** still says professionals "pay Nearest a membership fee" (contradicts §10 and the no-membership model).
2. **Terms §3** says students re-verify at least once each school year (the app no longer requires it) and lists "high school, college or trade school" — confirm **online students** are covered, since the public pages now say so.
3. **Price cap:** one $150 cap for every category, braiding and locs included (that's the code). No separate braid/loc ceiling is published.
4. **Insurance:** Terms require professional + general liability insurance; it's stated publicly on `/faq` and `/for-professionals`.
5. **Enrollment outside configured cities:** today a professional can only enroll in a city an owner has added. Confirm whether you want pros in any city to be able to build a full profile immediately (city created from their ZIP) or keep "interest first, owner opens the city".
6. **Contact:** support@ and hello@usenearest.com only; no phone or street address published.
7. **Legacy members** moved to the no-fee model — confirm wording.

## D. Google Search Console setup

1. search.google.com/search-console → Add property → **Domain** → `usenearest.com` → add the TXT record at your DNS provider → Verify.
   (Or URL-prefix property with the HTML tag: set `GOOGLE_SITE_VERIFICATION` in Vercel to the tag's content value and redeploy.)
2. Sitemaps → submit `https://www.usenearest.com/sitemap.xml`.
3. URL Inspection → request indexing for `/about-nearest`, `/for-professionals`, `/student-beauty-services`, `/faq`, `/locations` and two guides.
4. Bing Webmaster Tools → import from Search Console (optional).
5. Rich Results Test + validator.schema.org on `/about-nearest`, one guide and one city page.
6. Record day-0 baseline: indexed pages, impressions, clicks, CTR, average position, crawl errors.

## E. Measurement strategy (search visibility → registrations → referrals → bookings)

| Layer | Where | What to watch |
|---|---|---|
| Visibility | Search Console | Indexed public pages; impressions/clicks for branded queries ("nearest beauty booking", "nearest student beauty", "usenearest", "nearest booking platform") and topic queries (student beauty discounts, cheap haircuts students, free beauty business listing, get more nail clients…) |
| Engagement | Search Console → Pages | CTR per page; pages with impressions but low CTR get new titles/descriptions |
| Demand | Admin → City interest | Interest by city and role — where to open next |
| Registrations | Admin → Growth report | Student sign-ups, verified students, pro sign-ups per week |
| Referrals | Growth report, Sales Track, Sales Board | Pros via partner links, sign-ups via sales reps, rep link clicks |
| Bookings | Growth report, Command Center | Booking requests and completed bookings per week |

Cadence: weekly glance at Growth report + Search Console Pages; **day 30** branded visibility and indexing (≥ 80% of sitemap URLs);
**day 60** non-branded impressions growing and first sign-ups/interest from new cities; **day 90** rewrite the 3 weakest pages,
add guides for queries that get impressions without a dedicated page, open the cities with the most professional + student interest.
Search data lags days to weeks; don't judge before ~4 weeks. Don't measure with the bare word "nearest".

## F. QA

See the delivery notes for the latest run: anonymous 200s on every public page, canonical/H1/JSON-LD checks, sitemap and robots,
private routes still redirecting, existing sign-in/sign-up/pro pages and service worker unchanged, `npm run build` passing.
