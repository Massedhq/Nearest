# Nearest — SEO, AI discovery and public resource center

Built 2026-10-20 from the "Nearest SEO and AI Discovery" brief. This file is the record of what was audited, what
was built, how to maintain it, and what still needs an owner decision.

## A. Repository audit (before building)

| Area | Finding |
|---|---|
| Router | Next.js 16, App Router (`src/app`). Route groups already used: `(student)`, `pro/(app)`, `admin/(console)`. |
| Auth gate | `src/proxy.ts` (Clerk middleware). Any path not in `PUBLIC_EXACT` / `PUBLIC_PREFIX` redirects anonymous visitors to sign-in. New public pages must be listed there. |
| Canonical host | `metadataBase` = `APP_URL` or `https://www.usenearest.com`. Apex already 308-redirects to `www` on Vercel (see CLAUDE.md, Stripe webhook note). HTTPS everywhere. |
| robots / sitemap | Neither existed. |
| Public pages before | `/` (welcome), `/pro`, `/terms`, `/privacy`, `/supporters`, `/pro-<slug>` share pages, invite/token pages. |
| Metadata | Root title template `%s · Nearest`, Open Graph image `src/app/opengraph-image.png`, no canonicals, no JSON-LD. |
| Collisions | `src/app/[handle]` only matches `pro-<slug>`; static routes take priority. No conflicts with the new paths. |
| PWA | `public/sw.js` (install + phone alerts), `manifest.ts`, `InstallPrompt` banner. Unchanged except the banner is hidden on resource pages. |
| Verified product facts | Service fee `fees.service_fee_cents` (default $5, included in the student price — no separate booking fee); $150 cap per service incl. add-ons for every category (`src/lib/pricing.ts`); 5 First In / 10 max per city + category; request window 24 h (or 2 h before), pay window 12 h (or 1 h before); credits not cash refunds; address shared from 12:00 AM on the day; minors 13–17 need guardian approval; no monthly membership (`MEMBERSHIP_ENABLED = false`). |

## B. What was built

**Routes (all in `src/app/(public)`, server-rendered, anonymous, indexable):**

| Route | Purpose |
|---|---|
| `/about-nearest` | Brand identity and disambiguation, official details |
| `/for-professionals` | Main professional page: fees, eligibility, services, booking flow, capacity, profile help |
| `/student-beauty-services` | Students: pricing, booking steps, credits, safety, events, no school affiliation |
| `/grow-your-beauty-business` | Growth framework hub |
| `/free-business-listing` | Listing vs booking vs ads; honest comparison incl. Nearest |
| `/get-more-clients` | Tactics by profession |
| `/beauty-marketing-resources` | Copyable referral scripts, captions, opening posts, seasonal calendar |
| `/resources` | Editorial index by topic |
| `/resources/[slug]` | 12 editorial guides (Article schema) |
| `/locations` | Live cities from the database + planned New Mexico |
| `/locations/[state]/[city]` | Only cities with ≥1 live professional; others 404 |
| `/contact`, `/faq` | Contact details found in the codebase; 120 answered questions in 7 topics |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | Crawl rules, canonical URL list, optional AI summary |

**Files:**
- Content model: `src/content/faq.ts` (120 entries), `src/content/guides.ts` + `guides-a.ts` + `guides-b.ts` (12 guides).
- Live facts: `src/lib/public/facts.ts` reads the rules engine (fee, cap, notice, deposit, capacity) — public numbers follow Admin → Rules & Settings within an hour. Falls back to coded defaults if the database is unreachable.
- Locations: `src/lib/public/locations.ts` (same live rule as student search, `liveProWhere`; only aggregate data — never individual professionals, addresses or students).
- Shell/components: `src/components/public/*` (header/nav/footer, breadcrumbs + BreadcrumbList, accessible `<details>` FAQ, CTAs, JSON-LD).
- Schema: Organization + WebSite on every public page (sameAs = the Instagram account linked in the pro app), BreadcrumbList on nested pages, Article on guides. No LocalBusiness, ratings or FAQPage markup.
- `src/proxy.ts`: public exemptions. `src/components/InstallPrompt.tsx`: no install banner over articles.

**Content update workflow:** edit `src/content/*.ts`, bump `updated` on a guide when you materially change it, run `npm run build`, deploy. Product numbers don't need content edits — change them in Admin → Rules & Settings.

## C. Facts and policies that need owner confirmation

1. **Terms §6** still says "Professionals pay Nearest a membership fee" — contradicts the no-membership model (Terms §10 is correct). Public pages say no monthly fee.
2. **Terms §3** says students "re-verify when asked, at least once each school year" — the app no longer requires yearly re-verification.
3. **New Mexico, January 2027** — taken from the brief; shown as "planned", never bookable. Confirm or update `PLANNED_MARKETS` in `src/lib/public/locations.ts`.
4. **Price cap** — the code has one $150 cap for every category, braiding and locs included. The brief mentions a possible different ceiling for braiding/locs; none exists in code, so none is published.
5. **Insurance** — Terms require professional + general liability insurance; Professional Protection is interest-only. Confirm you want the requirement stated publicly (it is, on `/faq` and `/for-professionals`).
6. **"Started in Dallas–Fort Worth"** — used as the launch-history statement. Confirm wording.
7. **Contact** — support@usenearest.com and hello@usenearest.com (both used in the app). No phone or street address published; the legal mailing address stays in the Terms only.
8. **Legacy members** — pages say professionals with an earlier membership were moved to the no-fee model. Confirm.
9. **Author/review metadata** — guides are credited to "the Nearest team" (no invented individual authors).

## D. Google Search Console setup (owner access required)

1. Go to search.google.com/search-console → Add property → **Domain** → `usenearest.com`.
2. Add the TXT record Google gives you at your DNS provider; click Verify (DNS can take up to a few hours).
3. Sitemaps → submit `https://www.usenearest.com/sitemap.xml`.
4. URL Inspection → test `/for-professionals`, `/student-beauty-services`, `/faq`, one guide → Request indexing.
5. Optional: Bing Webmaster Tools → Import from Google Search Console.
6. Validate structured data: Google Rich Results Test and validator.schema.org on `/about-nearest`, one guide, one city page.
7. Record the baseline (day 0): indexed pages, impressions, clicks, CTR, average position, crawl errors.

## E. 30 / 60 / 90-day measurement plan

| When | Check | Healthy sign |
|---|---|---|
| Weekly | Pages report: indexed vs not indexed; crawl errors | All sitemap URLs move to Indexed; no "Blocked by robots" on public pages |
| Day 30 | Branded queries: "nearest beauty booking", "nearest student beauty", "usenearest", "nearest booking platform" | usenearest.com appears for branded queries; About page impressions |
| Day 30 | Coverage of the 24 resource URLs + live cities | ≥ 80% indexed |
| Day 60 | Non-branded impressions for guide topics ("get more nail clients", "beauty business flyer", "price student beauty services") | Rising impressions; average position improving |
| Day 60 | Clicks from guides to `/pro/sign-up` and `/sign-up` (add UTM-free tracking in your analytics, or count sign-ups with source) | First sign-ups attributed to the resource center |
| Day 90 | CTR by page; pages with impressions but low CTR | Rewrite titles/descriptions of the 3 weakest pages |
| Day 90 | New content plan | Add guides for the top queries that bring impressions but have no dedicated page |

Search Console data lags by days; don't judge before ~4 weeks. Don't use the bare word "nearest" as a performance measure.

## F. QA performed (2026-10-20, local demo copy with a demo database)

- 24 public pages + 1 live city page: HTTP 200 anonymously, no redirect, one H1 each, canonical = own URL, no `noindex`, unique titles and descriptions, valid JSON-LD (Organization + WebSite, BreadcrumbList, Article).
- `/robots.txt`, `/sitemap.xml` (28 URLs: public pages, guides, live cities, legal — no private routes), `/llms.txt`: 200.
- Existing flows unchanged: `/`, `/sign-in`, `/sign-up`, `/pro`, `/pro/sign-up`, `/terms`, `/privacy`, `/sw.js`, `/manifest.webmanifest` → 200. Private pages still redirect anonymous visitors: `/home`, `/account`, `/bookings` → `/sign-in`; `/pro/home` → `/pro/sign-in`; `/admin` → `/admin/sign-in`; `/api/push/key` → 401.
- Mobile (390 px): no horizontal scroll; FAQ uses native `<details>` (keyboard and screen-reader accessible, answers in server HTML).
- `npm run build` passes.
- Not done here (needs the live site): Rich Results Test, Lighthouse on production, Search Console.
