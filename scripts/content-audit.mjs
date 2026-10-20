#!/usr/bin/env node
/**
 * Nearest sitewide content audit.
 *
 * Reads the live sitemap from a running site, fetches every public page as rendered HTML (what Google sees),
 * inventories pages and FAQ entries, and checks for:
 *   - the word "marketplace" describing Nearest (use "platform")
 *   - competitor directories / booking platforms recommended in copy
 *   - one-state centering or fixed expansion timelines
 *   - outdated pricing (monthly memberships, "no separate booking fee", per-month prices)
 *   - booking-fee and price-cap amounts that don't match the platform's current values
 *   - guarantee claims (clients, bookings, income, placement)
 *   - missing calls to action (pro pages -> /pro/sign-up or /locations#check; student pages -> /sign-up)
 *   - CTA near the start and end of long articles
 *   - broken internal links
 *   - SEO basics: title, meta description, canonical, exactly one H1, valid JSON-LD
 *   - FAQ count and FAQ entries with no connection to Nearest
 *
 * Usage:
 *   npm run content:audit                          (defaults to http://localhost:3000)
 *   npm run content:audit -- https://www.usenearest.com
 *   AUDIT_FEE=5 AUDIT_CAP=150 AUDIT_FAQ_COUNT=120 npm run content:audit -- <base>
 *
 * Writes docs/content-audit-report.md and docs/content-audit-report.json. Exits 1 if any error-level issue is found.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = (process.argv[2] || process.env.AUDIT_BASE || "http://localhost:3000").replace(/\/$/, "");
const FEE = Number(process.env.AUDIT_FEE ?? 5);
const CAP = Number(process.env.AUDIT_CAP ?? 150);
const FAQ_COUNT = Number(process.env.AUDIT_FAQ_COUNT ?? 120);
const OUT = process.env.AUDIT_OUT || "docs";

// Pages whose audience is professionals / students. Anything under /resources is classified from its rendered topic label.
const PRO_PAGES = ["/pro", "/for-professionals", "/grow-your-beauty-business", "/free-business-listing", "/get-more-clients", "/beauty-marketing-resources"];
const STUDENT_PAGES = ["/", "/student-beauty-services"];
const NO_CTA_PAGES = ["/terms", "/privacy", "/contact"];

const COMPETITORS = ["Yelp", "Booksy", "Vagaro", "StyleSeat", "GlossGenius", "Fresha", "Square Appointments", "Schedulicity", "Acuity", "Thumbtack", "Nextdoor", "Groupon", "Apple Business Connect", "Bing Places", "Facebook Marketplace", "Treatwell", "Mindbody", "Booker", "Setmore", "Calendly", "Timely", "Zenoti", "Google Business Profile", "Google Maps", "Google profile", "Linktree"];
// Pages send people to Nearest, never to set up outside listings; and never explain what Nearest earns.
const OFF_PLATFORM = [/\blist (?:yourself |your business )?on (?:other )?platforms\b/i, /\bother listings?\b/i, /\bfound on Google\b/i, /\bclaim your Google\b/i];
const EARNINGS = [/\bNearest earns\b/i, /\bNearest's revenue\b/i, /\bhow Nearest (?:earns|makes money)\b/i, /\bNearest keeps\b/i, /\bno (?:other )?commission\b/i];
const STATE_CENTERING = [/\bDFW\b/, /\bDallas\b/, /\bFort Worth\b/, /\bNew Mexico\b(?!.*\bNew York\b)/, /\bJanuary 2027\b/, /\b(?:launching|expanding) (?:in|to) Texas\b/i, /\bTexas[- ]based\b/i];
const SKIP_STATE_PATHS = ["/terms", "/privacy"]; // legal address and governing law are legitimate Texas references

const issues = [];
const add = (severity, category, page, detail) => issues.push({ severity, category, page, detail });

function text(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}
function mainHtml(html) {
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  return m ? m[0] : html;
}
const near = (s, i, n = 60) => s.slice(Math.max(0, i - n), i + n).trim();

function contentChecks(page, t) {
  // marketplace
  for (const m of t.matchAll(/marketplace/gi)) add("error", "Uses \"marketplace\"", page, near(t, m.index));
  // competitors
  for (const c of COMPETITORS) {
    const re = new RegExp(`\\b${c.replace(/ /g, "\\s+")}\\b`, "g");
    for (const m of t.matchAll(re)) add("error", "Competitor mentioned", page, `${c}: …${near(t, m.index)}…`);
  }
  for (const re of OFF_PLATFORM) { const m = t.match(re); if (m) add("error", "Sends people off Nearest", page, near(t, m.index)); }
  for (const re of EARNINGS) { const m = t.match(re); if (m) add("error", "Explains what Nearest earns", page, near(t, m.index)); }
  // state centering
  if (!SKIP_STATE_PATHS.includes(page)) for (const re of STATE_CENTERING) {
    const m = t.match(re); if (m) add("error", "State-centered or dated expansion copy", page, near(t, m.index));
  }
  // outdated pricing
  for (const m of t.matchAll(/no separate booking fee/gi)) add("error", "Outdated pricing", page, near(t, m.index));
  for (const m of t.matchAll(/\$\d+(?:\.\d\d)?\s*(?:\/|per|a)\s*(?:month|mo)\b/gi)) add("error", "Outdated pricing", page, `Monthly price: ${near(t, m.index)}`);
  for (const m of t.matchAll(/membership fee/gi)) {
    const before = t.slice(Math.max(0, m.index - 30), m.index).toLowerCase();
    if (!/\bno\b|without|not|isn't|doesn't|never/.test(before) && !SKIP_STATE_PATHS.includes(page)) add("error", "Outdated pricing", page, `Membership fee implied: ${near(t, m.index)}`);
  }
  // fee amount consistency
  for (const m of t.matchAll(/\$(\d+(?:\.\d\d)?)\s*(?:booking|service)\s+fee/gi)) if (Number(m[1]) !== FEE) add("error", "Inconsistent booking fee", page, near(t, m.index));
  for (const m of t.matchAll(/(?:booking|service) fee[^.$]{0,40}\(currently \$(\d+(?:\.\d\d)?)\)/gi)) if (Number(m[1]) !== FEE) add("error", "Inconsistent booking fee", page, near(t, m.index));
  // cap consistency
  for (const m of t.matchAll(/(?:more than|up to|limit(?: is)?|capped at|cap of|maximum of)\s*\$(\d+(?:\.\d\d)?)/gi)) {
    const v = Number(m[1]); const ctx = near(t, m.index, 80).toLowerCase();
    if (v !== CAP && /service|price|add-on|student/.test(ctx) && !/budget|spend|save|aim|under \$/.test(ctx)) add("warn", "Possible price-cap mismatch", page, near(t, m.index));
  }
  // guarantees
  for (const m of t.matchAll(/guarantee[sd]?\s+(?:you\s+)?(?:more\s+|new\s+)?(clients|bookings|income|revenue|visibility|placement|results)/gi)) {
    const before = t.slice(Math.max(0, m.index - 45), m.index).toLowerCase();
    if (/^[^.]*\?\s*No\b/.test(t.slice(m.index, m.index + 60))) continue; // a question answered "No"
    if (!/\bno\b|\bnot\b|n't|never|does |doesn't|without|nothing|can't|cannot|nobody|no one/.test(before)) add("error", "Guarantee claim", page, near(t, m.index));
  }
}

async function get(url, method = "GET") {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { method, redirect: "manual", headers: { "user-agent": "NearestContentAudit/1.0 (+Googlebot-like)" } });
      return { status: r.status, location: r.headers.get("location"), body: method === "GET" ? await r.text() : "" };
    } catch (e) { if (i === 2) return { status: 0, body: "", error: String(e) }; await new Promise((r) => setTimeout(r, 1500)); }
  }
}

const sm = await get(`${BASE}/sitemap.xml`);
if (sm.status !== 200) { console.error(`Could not read ${BASE}/sitemap.xml (status ${sm.status})`); process.exit(2); }
const urls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const toPath = (u) => { try { const x = new URL(u); return x.pathname + (x.hash || ""); } catch { return u; } };
const pages = urls.map((u) => new URL(u).pathname);

const rb = await get(`${BASE}/robots.txt`);
if (rb.status !== 200) add("error", "Crawl access", "/robots.txt", `status ${rb.status}`);
else {
  if (/^\s*disallow:\s*\/\s*$/im.test(rb.body)) add("error", "Crawl access", "/robots.txt", "Disallow: / blocks the whole site");
  if (!/sitemap:/i.test(rb.body)) add("warn", "Crawl access", "/robots.txt", "No Sitemap: line");
}

const inventory = [];
const links = new Map(); // path -> [pages]
let faqEntries = 0;

for (const p of pages) {
  const r = await get(BASE + p);
  if (r.status !== 200) { add("error", "Page not reachable", p, `status ${r.status}${r.location ? ` → ${r.location}` : ""}`); continue; }
  const html = r.body;
  const main = mainHtml(html);
  const t = text(main);
  const words = t.split(" ").length;

  // SEO basics
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || "";
  const canon = (html.match(/<link rel="canonical" href="([^"]*)"/i) || [])[1] || "";
  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  if (!title || title === "Nearest") add("error", "SEO basics", p, `Weak or missing title: "${title}"`);
  if (!desc) add("error", "SEO basics", p, "Missing meta description");
  if (!canon) add("error", "SEO basics", p, "Missing canonical");
  else if (toPath(canon).replace(/\/$/, "") !== p.replace(/\/$/, "")) add("warn", "SEO basics", p, `Canonical points elsewhere: ${canon}`);
  if (h1s !== 1) add("error", "SEO basics", p, `${h1s} H1 elements (expected 1)`);
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) add("error", "Crawl access", p, "noindex on a sitemap page");
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(m[1]); } catch { add("error", "Structured data", p, "Invalid JSON-LD"); }
  }

  contentChecks(p, t);

  // audience + CTA
  const topic = (main.match(/class="pub-eyebrow"[^>]*>([^<]*)</) || [])[1] || "";
  let audience = "general";
  if (PRO_PAGES.includes(p)) audience = "professional";
  else if (STUDENT_PAGES.includes(p)) audience = "student";
  else if (p.startsWith("/resources/")) {
    const a = (main.match(/data-audience="([^"]+)"/) || [])[1];
    audience = a ? (a === "pro" ? "professional" : "student") : /students? (?:&|and) parents/i.test(topic) ? "student" : "professional";
  }
  else if (p.startsWith("/locations") || p === "/faq" || p === "/resources" || p === "/about-nearest") audience = "both";
  const hrefs = [...main.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  const proCta = (h) => /^\/pro\/sign-up\b|^\/locations#check|^\/pro$/.test(h);
  const stuCta = (h) => /^\/sign-up\b|^\/locations#check|^\/student-beauty-services/.test(h);
  if (!NO_CTA_PAGES.includes(p)) {
    if (audience === "professional" && !hrefs.some(proCta)) add("error", "Missing call to action", p, "No link to professional sign-up or the city checker");
    if (audience === "student" && !hrefs.some((h) => /^\/sign-up\b/.test(h))) add("error", "Missing call to action", p, "No link to student sign-up");
    if (audience === "both" && !hrefs.some(proCta) && !hrefs.some(stuCta)) add("error", "Missing call to action", p, "No Nearest call to action");
    if (words > 1200 && p.startsWith("/resources/")) {
      const isCta = audience === "student" ? stuCta : proCta;
      const positions = [...main.matchAll(/href="([^"]+)"/g)].filter((m) => isCta(m[1])).map((m) => m.index / main.length);
      if (!positions.some((x) => x < 0.35)) add("warn", "CTA placement", p, "Long article with no call to action near the beginning");
      if (!positions.some((x) => x > 0.65)) add("warn", "CTA placement", p, "Long article with no call to action near the end");
    }
  }

  // internal links
  for (const h of hrefs) {
    if (h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:")) continue;
    let target;
    if (h.startsWith("/")) target = h;
    else if (h.startsWith(BASE) || /^https?:\/\/(www\.)?usenearest\.com/.test(h)) target = toPath(h);
    else continue;
    const clean = target.split("#")[0].split("?")[0] || "/";
    if (/\.(png|jpg|jpeg|svg|webp|ico|webmanifest)$/.test(clean)) continue;
    if (!links.has(clean)) links.set(clean, new Set());
    links.get(clean).add(p);
    // anchors on the same site: verify fragment exists later
    if (target.includes("#")) { const k = `${clean}#${target.split("#")[1]}`; if (!links.has(k)) links.set(k, new Set()); links.get(k).add(p); }
  }

  // FAQ entries
  let faqHere = 0;
  if (p === "/faq") {
    const items = [...main.matchAll(/<details[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/details>/g)];
    faqHere = items.length;
    faqEntries = items.length;
    if (items.length !== FAQ_COUNT) add("error", "FAQ inventory", p, `${items.length} FAQ entries rendered (expected ${FAQ_COUNT})`);
    const ids = new Set();
    for (const [, id, body] of items) {
      if (ids.has(id)) add("error", "FAQ inventory", p, `Duplicate FAQ id ${id}`);
      ids.add(id);
      const ft = text(body);
      if (!/Nearest/.test(ft)) add("warn", "FAQ not connected to Nearest", `/faq#${id}`, ft.slice(0, 110));
    }
  }
  inventory.push({ path: p, audience, title, words, faq: faqHere || undefined });
}

// Verify internal links (and fragments)
const pageCache = new Map();
for (const [target, from] of links) {
  const [pathPart, frag] = target.split("#");
  if (!pageCache.has(pathPart)) {
    const r = await get(BASE + pathPart);
    let ok = r.status === 200 || ((r.status === 307 || r.status === 308 || r.status === 302) && r.location);
    pageCache.set(pathPart, { ok, status: r.status, body: r.body || "" });
  }
  const c = pageCache.get(pathPart);
  if (!c.ok) add("error", "Broken internal link", [...from].join(", "), `${target} → status ${c.status}`);
  else if (frag && c.status === 200 && !new RegExp(`id="${frag}"`).test(c.body)) add("error", "Broken internal link", [...from].join(", "), `${target} → anchor #${frag} not found`);
}

// Report
const errors = issues.filter((i) => i.severity === "error");
const warns = issues.filter((i) => i.severity === "warn");
const byCat = {};
for (const i of issues) (byCat[i.category] ||= []).push(i);
const now = new Date().toISOString();
let md = `# Nearest content audit\n\nBase: ${BASE}  \nRun: ${now}  \nExpected booking fee: $${FEE} · price cap: $${CAP} · FAQ entries: ${FAQ_COUNT}\n\n`;
md += `## Totals\n\n- Pages audited (from sitemap): **${inventory.length}** of ${pages.length}\n- FAQ entries audited: **${faqEntries}**\n- Internal link targets checked: **${links.size}**\n- Errors: **${errors.length}** · Warnings: **${warns.length}**\n\n`;
md += `## Issues by category\n\n`;
if (!issues.length) md += "None.\n\n";
for (const [cat, list] of Object.entries(byCat)) {
  md += `### ${cat} (${list.length})\n\n`;
  for (const i of list) md += `- [${i.severity}] \`${i.page}\` — ${i.detail}\n`;
  md += "\n";
}
md += `## Inventory\n\n| Page | Audience | Words | Title |\n|---|---|---|---|\n`;
for (const r of inventory) md += `| ${r.path} | ${r.audience} | ${r.words}${r.faq ? ` (${r.faq} FAQs)` : ""} | ${r.title.replace(/\|/g, "\\|")} |\n`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "content-audit-report.md"), md);
fs.writeFileSync(path.join(OUT, "content-audit-report.json"), JSON.stringify({ base: BASE, run: now, inventory, faqEntries, issues }, null, 2));
console.log(`Pages ${inventory.length}/${pages.length} · FAQs ${faqEntries} · link targets ${links.size} · errors ${errors.length} · warnings ${warns.length}`);
for (const [cat, list] of Object.entries(byCat)) console.log(`  ${cat}: ${list.length}`);
console.log(`Report: ${path.join(OUT, "content-audit-report.md")}`);
process.exit(errors.length ? 1 : 0);
