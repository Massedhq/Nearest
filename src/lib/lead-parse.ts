/**
 * Turns OCR text from a professional's screenshots into lead details — no AI, no outside service. Runs in the browser
 * right after Tesseract reads the screenshots (and in tests). Rules only take what is visibly written:
 * labeled lines ("Phone 469-…"), recognizable patterns (emails, phone numbers, web addresses, @handles, street
 * addresses), and Instagram/Facebook page cues. Anything not found stays blank for the reviewer.
 */

export type ParsedLead = {
  name: string; business: string; category: string; otherServices: string; credentials: string;
  address: string; city: string; state: string; zip: string;
  email: string; phone: string; instagram: string; facebook: string; profileLink: string; website: string; bookingLink: string;
  source: string; hours: string; prices: string; deposit: string;
};
export const PARSED_KEYS: (keyof ParsedLead)[] = ["name", "business", "category", "otherServices", "credentials", "address", "city", "state", "zip", "email", "phone", "instagram", "facebook", "profileLink", "website", "bookingLink", "source", "hours", "prices", "deposit"];
export const FIELD_LABEL: Record<keyof ParsedLead, string> = {
  name: "Name", business: "Business name", category: "Category", otherServices: "Other services", credentials: "Credentials", address: "Address", city: "City", state: "State", zip: "ZIP",
  email: "Email", phone: "Phone", instagram: "Instagram", facebook: "Facebook", profileLink: "Profile link", website: "Website", bookingLink: "Booking link", source: "Source", hours: "Hours", prices: "Service prices", deposit: "Deposit",
};

const BOOKING_HOSTS = /(as\.me|acuityscheduling\.com|booksy\.com|vagaro\.com|glossgenius\.com|square\.site|squareup\.com|styleseat\.com|fresha\.com|schedulicity\.com|setmore\.com|calendly\.com|zenoti\.com|mindbodyonline\.com|boulevard\.io|joinblvd\.com|gettimely\.com|booker\.com|appointy\.com|simplybook\.me)$/i;
const BIO_HOSTS = /^(linktr\.ee|linkin\.bio|beacons\.ai|bio\.site|lnk\.bio|tap\.bio|campsite\.bio|msha\.ke|stan\.store|hoo\.be|allmylinks\.com)$/i;
const MAIL_HOSTS = ["gmail.com", "yahoo.com", "icloud.com", "outlook.com", "hotmail.com", "aol.com", "live.com", "me.com", "msn.com", "att.net", "sbcglobal.net", "protonmail.com"];
const STREET = "(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|parkway|pkwy|highway|hwy|way|court|ct|circle|cir|trail|trl|freeway|fwy|place|pl|plaza|plz|loop|expressway|expy|tollway|square|sq|row|run|pass|crossing|xing)";
const STATES: Record<string, string> = { texas: "TX", tx: "TX", oklahoma: "OK", ok: "OK", louisiana: "LA", la: "LA", arkansas: "AR", ar: "AR", "new mexico": "NM", nm: "NM" };

const CATEGORY_WORDS: [RegExp, string][] = [
  [/\blash(es)?\b|\blash\s?(tech|artist)|eyelash|wispy|volume set|hybrid set|classic set/gi, "Lashes"],
  [/\bbrows?\b|microblad|lamination|threading/gi, "Brows"],
  [/\bnails?\b|manicur|pedicur|acrylic|gel-?x|nail tech/gi, "Nails"],
  [/\bbarber|\bfades?\b|lineup|line-up|tapers?\b|shave/gi, "Barber"],
  [/\bbraid|knotless|cornrow/gi, "Braids"],
  [/\blocs?\b|loctician|retwist|starter locs/gi, "Locs"],
  [/silk press|\bwigs?\b|sew-?in|stylist|cosmetolog|hair ?stylist|blowout|\bhair\b/gi, "Hair"],
  [/makeup|\bmua\b|\bglam\b/gi, "Makeup"],
  [/esthetic|facials?\b|skin ?care|dermaplan|hydrafacial|chemical peel/gi, "Esthetician/Skincare"],
  [/\bwax(ing)?\b|sugaring|laser hair/gi, "Hair Removal"],
  [/massage/gi, "Massage"],
  [/tattoo|pierc/gi, "Tattoos & Piercings"],
  [/spray tan|teeth whitening/gi, "Body & Wellness"],
  [/photograph/gi, "Photography"],
  [/personal trainer|fitness|pilates|\byoga\b/gi, "Fitness"],
];

// Labeled lines: "Phone 469-608-1690", "Business name: KNZ Beauty Bar", "Found through Instagram"…
const LABELS: [RegExp, keyof ParsedLead | "skip"][] = [
  [/^(?:professional|contact|full|owner|artist)?\s*name\b[:\-]?\s*/i, "name"],
  [/^(?:business|brand|salon|studio|shop)\s*name\b[:\-]?\s*/i, "business"],
  [/^(?:phone|tel|telephone|cell|mobile|call|text)\b[:\-]?\s*/i, "phone"],
  [/^e-?mail\b[:\-]?\s*/i, "email"],
  [/^instagram\b[:\-]?\s*(?=@|\S)/i, "instagram"],
  [/^facebook\b[:\-]?\s*/i, "facebook"],
  [/^(?:found (?:through|on|via)|source)\b[:\-]?\s*/i, "source"],
  [/^(?:service\s+)?categor(?:y|ies)\b[:\-]?\s*/i, "category"],
  [/^(?:specialt(?:y|ies)|services offered|other services)\b[:\-]?\s*/i, "otherServices"],
  [/^(?:listed\s+)?(?:credentials?|licen[sc]e)\b[:\-]?\s*/i, "credentials"],
  [/^(?:street\s+)?address\b[:\-]?\s*/i, "address"],
  [/^(?:booking (?:website|site|link)|book (?:here|online|now))\b[:\-]?\s*/i, "bookingLink"],
  [/^(?:website|additional link|link in bio|links?)\b[:\-]?\s*/i, "website"],
  [/^(?:service\s+)?prices?\b[:\-]?\s*/i, "prices"],
  [/^deposit\b[:\-]?\s*/i, "deposit"],
  [/^(?:business\s+)?hours\b[:\-]?\s*/i, "hours"],
  [/^(?:market served|service area|location|city)\b[:\-]?\s*/i, "skip"],
  [/^(?:prospect field|information from screenshots)\b/i, "skip"],
];
const MULTILINE: (keyof ParsedLead)[] = ["address", "otherServices", "credentials", "category", "deposit", "prices", "hours"];

const LICENSED = /\b(licensed\s+(?:master\s+)?(?:esthetician|cosmetologist|barber|manicurist|nail tech(?:nician)?|lash (?:artist|technician)|massage therapist|tattoo artist|body piercer|eyelash extension specialist))\b/i;
const clean = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

/** OCR often reads "@" as ®, © or ®Q, and wraps text; fix the common slips before matching. */
export function fixOcr(line: string) {
  return line
    .replace(/[®©]\s?[QO0]?(?=[a-z]*(?:gmail|yahoo|icloud|outlook|hotmail|aol|live)\b)/gi, "@")
    .replace(/[®©]/g, "@")
    .replace(/\s+@\s+(?=[a-z0-9-]+\.[a-z]{2,})/gi, "@")
    .replace(/\(at\)|\[at\]/gi, "@")
    .replace(/\s*\.\s*(com|net|org|me|ee|co)\b/gi, ".$1");
}

export function normalizeEmail(raw: string) {
  const m = raw.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  if (!m) return "";
  let [user, host] = m[0].split("@");
  user = user.replace(/^[._-]+|[._-]+$/g, "");
  const fixed = MAIL_HOSTS.find((h) => host !== h && host.endsWith(h) && host.length - h.length <= 2); // "qgmail.com" → "gmail.com"
  if (fixed) host = fixed;
  return user && host ? `${user}@${host}` : "";
}
export function normalizePhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 && /^[2-9]\d{2}[2-9]/.test(d) ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : "";
}
const handleOf = (raw: string) => (raw.match(/@?\s?([a-z0-9._]{3,30})/i)?.[1] ?? "").toLowerCase().replace(/^\.+|\.+$/g, "");

type Cand = { value: string; score: number; shot: number };

/** Parse the OCR text of each screenshot (same professional) into one set of details, plus conflicts to check. */
export function parseLeadText(input: (string | string[])[]): { fields: ParsedLead; conflicts: string[]; found: (keyof ParsedLead)[] } {
  // Each screenshot may come with several OCR passes (different image clean-ups) — all are searched for details.
  const shots = input.map((x) => (Array.isArray(x) ? x : [x]));
  const cands: Partial<Record<keyof ParsedLead, Cand[]>> = {};
  const add = (k: keyof ParsedLead, value: string, score: number, shot: number) => {
    let v = clean(value);
    // Every value must look like what it claims to be — OCR noise next to a label is dropped, never saved.
    if (k === "email") v = normalizeEmail(v);
    else if (k === "phone") v = normalizePhone(v);
    else if (k === "instagram") v = /^@?\s?[a-z0-9._]{3,30}$/i.test(v) ? handleOf(v) : "";
    else if (k === "facebook") v = /^[a-z0-9.]{3,50}$/i.test(v) ? v.toLowerCase() : "";
    else if (k === "website" || k === "bookingLink" || k === "profileLink") { v = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").toLowerCase(); if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(v)) v = ""; }
    else if (k === "zip") v = v.match(/\b\d{5}\b/)?.[0] ?? "";
    else if (k === "deposit") v = v.match(/\$\s?\d+(?:\.\d{2})?/)?.[0]?.replace(/\s/g, "") ?? "";
    else if (k === "credentials") v = v.match(LICENSED)?.[1] ?? v.split(/\s[—–-]\s?|—/)[0];
    else if ((k === "name" || k === "business" || k === "city") && score >= 5 && !/^[A-Z0-9]/.test(v)) v = ""; // "business name and Instagram handle," is a sentence, not a value
    if (k === "city") v = titleCase(v);
    if (!v) return;
    (cands[k] ??= []).push({ value: v, score, shot });
  };
  const catScore = new Map<string, number>();
  const catFirst = new Map<string, number>();
  let pos = 0;

  shots.forEach((passes, shot) => {
    const text = passes.join("\n");
    const lines = text.split(/\r?\n/).map((l) => clean(fixOcr(l))).filter(Boolean);
    const all = lines.join("\n");
    // --- page cues for the source
    if (/\bfollowers\b/i.test(all) && /\bfollowing\b/i.test(all) && /\bposts\b/i.test(all)) add("source", "Instagram", 3, shot);
    if (/instagram\.com\//i.test(all) || lines.some((l) => /^instagram$/i.test(l.replace(/[^a-z]/gi, "")))) add("source", "Instagram", 2, shot);
    if (/facebook\.com\//i.test(all) || /\b(likes|people follow this|page · )\b/i.test(all) && /facebook/i.test(all)) add("source", "Facebook", 2, shot);

    // --- labeled lines (with continuation lines for multi-line values)
    let current: keyof ParsedLead | "skip" | null = null;
    lines.forEach((line, i) => {
      const hit = LABELS.find(([re]) => re.test(line));
      if (hit) {
        const [re, key] = hit;
        current = key;
        const rest = line.replace(re, "").trim();
        if (key !== "skip" && rest) add(key, rest, 5, shot);
        return;
      }
      if (current && current !== "skip" && MULTILINE.includes(current) && i > 0 && !/^[+]|reply to|share a link/i.test(line)) {
        const list = cands[current];
        const last = list?.[list.length - 1];
        if (last && last.shot === shot && last.score === 5 && line.length < 80 && !/[.!?]$/.test(last.value) && !/^(yes|no|nearest should)/i.test(line)) last.value = clean(`${last.value} ${line}`);
        else current = null;
      } else current = null;
    });

    for (const [i, line] of lines.entries()) {
      // --- emails, phones
      for (const m of line.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) add("email", normalizeEmail(m[0]), 4, shot);
      for (const m of line.matchAll(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g)) { const p = normalizePhone(m[0]); if (p) add("phone", p, 4, shot); }
      // --- web addresses
      for (const m of line.matchAll(/\b((?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+(?:com|me|net|org|co|ee|io|app|site|biz|us|beauty|salon|studio|store|bio|ai|link)(?:\/[\w./?=&%-]*)?)/gi)) {
        const url = m[1].replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[.,)]+$/, "");
        const host = url.split("/")[0].toLowerCase();
        if (MAIL_HOSTS.includes(host) || line.includes(`@${host}`)) continue;
        if (host === "instagram.com") { const h = handleOf(url.split("/")[1] ?? ""); if (h) { add("instagram", h, 5, shot); add("profileLink", `instagram.com/${h}`, 5, shot); } continue; }
        if (host === "facebook.com" || host === "fb.com" || host === "m.facebook.com") { const h = url.split("/")[1] ?? ""; if (h && !/^(profile\.php|share|sharer)/i.test(h)) add("facebook", h.toLowerCase(), 5, shot); add("profileLink", url.toLowerCase(), 4, shot); continue; }
        if (BOOKING_HOSTS.test(host)) add("bookingLink", url.toLowerCase(), 4, shot);
        else if (BIO_HOSTS.test(host)) add("website", url.toLowerCase(), 4, shot);
        else if (/\.(com|net|org|co|beauty|salon|studio|site|store|me|biz|us)$/i.test(host) && host.length > 5) add("website", url.toLowerCase(), 2, shot);
      }
      // --- @handles (not emails); on an Instagram page they're Instagram handles
      // ("@ DALLAS, TX" is a map-pin icon read as @, and "@ 469-…" a phone icon — those aren't handles)
      for (const m of line.matchAll(/(?:^|[\s(])@\s?([a-z0-9._]{3,30})\b(?!\.(?:com|net|org))(?!\s*,)(?![\s.-]*\d{3})/gi)) if (!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(line) && /[a-z]/i.test(m[1])) add("instagram", m[1].toLowerCase(), 3, shot);
      // Instagram profile header: "< knzbeautybar" at the top
      if (i < 4 && /^[<←—\-\s]*([a-z0-9._]{3,30})\b\s*\W*$/i.test(line) && /followers/i.test(all)) { const h = line.replace(/^[<←—\-\s]*/, "").match(/^([a-z0-9._]{3,30})/i)?.[1]; if (h && /[a-z]/.test(h) && h === h.toLowerCase()) add("instagram", h, 4, shot); }

      // --- street address (may wrap to the next line), city, state, ZIP
      const addr = line.match(new RegExp(`\\b\\d{2,6}\\s+[A-Za-z0-9 .'#-]{2,40}?\\b${STREET}\\b\\.?(?:[ ,]+(?:suite|ste|unit|apt|#)\\.?\\s*[A-Za-z0-9-]+)?`, "i"));
      if (addr) {
        let full = line.slice(addr.index);
        if (!/(TX|Texas)\.?,?\s*\d{5}/i.test(full) && lines[i + 1] && /^(?:[A-Za-z .'-]+,\s*)?(?:[A-Za-z .]+\s)?\d{5}(?:-\d{4})?$|^[A-Za-z .'-]+,\s*(?:TX|Texas)/i.test(lines[i + 1])) full = `${full} ${lines[i + 1]}`;
        add("address", full.replace(/[^\w\s,#.'-]+$/g, ""), 4, shot);
      }
      const csz = line.match(/([A-Z][A-Za-z.'-]+(?:\s[A-Z][A-Za-z.'-]+){0,3}),\s*(Texas|TX|Tx|Oklahoma|OK|Louisiana|LA)\b\.?\s*(\d{5})?/);
      if (csz) {
        const weak = !csz[3] && !addr; // "Dallas, Tx" in a bio = area served, not the address
        add("city", csz[1], weak ? 1 : 4, shot); add("state", STATES[csz[2].toLowerCase()] ?? csz[2].toUpperCase(), weak ? 1 : 4, shot);
        if (csz[3]) add("zip", csz[3], 4, shot);
      }
      if (/^\d{5}(?:-\d{4})?$/.test(line) && i > 0 && /(TX|Texas)\s*,?$/i.test(lines[i - 1])) add("zip", line.slice(0, 5), 4, shot);

      // --- credentials, name/business cues
      const lic = line.match(LICENSED);
      if (lic) add("credentials", lic[1].replace(/\b\w/g, (c) => c.toUpperCase()), 3, shot);
      const ceo = line.match(/^[—\-–\s]*([A-Z][A-Za-z'’-]+(?:\s[A-Z][A-Za-z'’-]+){0,2}),?\s+(?:CEO|OWNER|FOUNDER|ARTIST|PRESIDENT)\s+(?:OF|AT)\s+(.{3,40})$/i);
      if (ceo) { add("name", titleCase(ceo[1]), 4, shot); add("business", titleCase(ceo[2]), 4, shot); }
      const bar = line.match(/^([A-Z][A-Za-z'’-]+(?:\s[A-Z][A-Za-z'’-]+)?)\s*\|\s*(.+)$/); // Instagram display name "Kenzie | Dallas Lash & Brow Artist"
      if (bar && i < 6 && /followers/i.test(all)) add("name", bar[1], 2, shot);
      if (/^[A-Z0-9][A-Za-z0-9&'’ .-]{2,40}\b(?:beauty bar|beauty|studio|salon|spa|lounge|barbershop|barber shop|lashes|nails|braids|boutique|bar)$/i.test(line) && line.split(" ").length <= 5 && !/^(book|licensed|specializing|for|meet)\b/i.test(line)) add("business", titleCase(line), 2, shot);

      // --- hours: "10AM - 5:30PM" then the days on the next line
      const hr = line.match(/^(\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?)\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?)/i);
      if (hr) { const days = lines[i + 1] && /(mon|tue|wed|thu|fri|sat|sun)/i.test(lines[i + 1]) ? ` ${titleCase(lines[i + 1].match(/[A-Za-z &]+(?:to|-|&)?[A-Za-z &]*/)?.[0] ?? "")}` : ""; add("hours", `${hr[1].toUpperCase()}–${hr[2].toUpperCase()}${days}`, 3, shot); }
      if (/^closed$/i.test(line) && lines[i + 1] && /(mon|tue|wed|thu|fri|sat|sun)/i.test(lines[i + 1])) add("hours", `Closed ${titleCase(lines[i + 1])}`, 3, shot);

      // --- money: deposits are kept apart from service prices; fees and policies are neither
      for (const m of line.matchAll(/\$\s?(\d{1,4}(?:\.\d{2})?)/g)) {
        const near = `${lines[i - 1] ?? ""} ${line} ${lines[i + 1] ?? ""}`;
        if (/deposit/i.test(line) || (/deposit/i.test(near) && !/[A-Za-z]{3,}.*\$/.test(line.replace(/deposit/i, "")))) add("deposit", `$${m[1]}`, 4, shot);
        else if (/\b(fee|late|no.?show|cancel|refund|charge|balance|tip)/i.test(line)) continue;
        else {
          const svc = line.replace(/\$\s?\d[\d.,]*\+?/g, "").replace(/\b(from|starting at|price|only)\b/gi, "").replace(/[•·|:\-–—]+/g, " ").trim();
          if (/[a-z]{3,}/i.test(svc) && svc.length <= 50 && !/(followers|posts)/i.test(svc)) add("prices", `${titleCase(svc)} — $${m[1]}`, 3, shot);
        }
      }
    }

    // --- service category from what they describe. Each distinct line counts once (several OCR passes repeat lines);
    // a headline ("Dallas Lash & Brow Artist") counts triple; "esthetician" is a license, so it only counts half.
    // Scored per pass and the best pass kept, so a word read twice by two passes isn't counted twice.
    const best = new Map<string, number>();
    for (const pass of passes) {
      const score = new Map<string, number>();
      for (const raw of pass.split(/\r?\n/)) {
        const line = clean(fixOcr(raw));
        if (!line) continue;
        const headline = /\b(artist|tech|technician|specialist|stylist|barber|braider|loctician)\b/i.test(line) && line.length < 60;
        for (const [re, cat] of CATEGORY_WORDS) {
          const ms = [...line.matchAll(re)];
          if (!ms.length) continue;
          const w = (cat === "Esthetician/Skincare" && /esthetic/i.test(line) && !/facial|skin/i.test(line) ? 0.5 : 1) * (headline ? 3 : 1);
          score.set(cat, (score.get(cat) ?? 0) + ms.length * w);
          const at = pos * 1000 + (ms[0].index ?? 0);
          if (!catFirst.has(cat) || at < catFirst.get(cat)!) catFirst.set(cat, at);
        }
        pos++;
      }
      for (const [c, v] of score) best.set(c, Math.max(best.get(c) ?? 0, v));
    }
    for (const [c, v] of best) catScore.set(c, (catScore.get(c) ?? 0) + v);
  });

  // Labeled categories ("Category Esthetician; lashes and brows") feed the same keyword count.
  const ranked = [...catScore.entries()].sort((a, b) => b[1] - a[1] || (catFirst.get(a[0]) ?? 0) - (catFirst.get(b[0]) ?? 0)).map(([c]) => c);
  delete cands.category;
  if (ranked.length) add("category", ranked[0], 5, 0);
  if (ranked.length > 1) add("otherServices", ranked.slice(1, 5).join(", "), 1, 0);

  // An icon right before a handle is often read as one extra letter ("®DKNZBEAUTYBAR"). If the handle minus its
  // first letter is a name seen elsewhere (another handle, a booking or link-in-bio address), it's that name.
  if (cands.instagram?.length) {
    const known = new Set<string>(cands.instagram.map((c) => c.value.toLowerCase()));
    for (const k of ["bookingLink", "website", "profileLink"] as const) for (const c of cands[k] ?? []) for (const t of c.value.toLowerCase().split(/[^a-z0-9_]+/)) if (t.length >= 3) known.add(t);
    for (const c of cands.instagram) { const v = c.value.toLowerCase(); if (known.has(v.slice(1)) && v.length > 4) c.value = v.slice(1); }
  }

  // Pick one value per field; different values for the same field are conflicts the reviewer must check.
  const fields = Object.fromEntries(PARSED_KEYS.map((k) => [k, ""])) as ParsedLead;
  const conflicts: string[] = [];
  const same = (k: keyof ParsedLead, v: string) => k === "phone" ? v.replace(/\D/g, "") : k === "instagram" || k === "email" || k === "website" || k === "bookingLink" ? v.toLowerCase().replace(/\/$/, "") : v.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const k of PARSED_KEYS) {
    const list = cands[k];
    if (!list?.length) continue;
    if (k === "prices" || k === "hours") { fields[k] = [...new Map(list.map((c) => [same(k, c.value), c.value])).values()].join("; "); continue; }
    const best = [...list].sort((a, b) => b.score - a.score)[0];
    fields[k] = best.value;
    if (k === "otherServices" || k === "credentials" || k === "address" || k === "source" || k === "city" || k === "state") {
      // weaker cues (a bio's "Dallas, TX") never conflict with a full street address
      const strong = list.filter((c) => c.score >= 3 && same(k, c.value) !== same(k, best.value) && !(k === "address" && same(k, best.value).includes(same(k, c.value)) || k === "address" && same(k, c.value).includes(same(k, best.value))));
      if (strong.length && k !== "otherServices" && k !== "credentials") conflicts.push(`${FIELD_LABEL[k]}: "${best.value}" vs "${strong[0].value}"`);
      continue;
    }
    const other = list.find((c) => c.score >= 3 && same(k, c.value) !== same(k, best.value));
    if (other) conflicts.push(`${FIELD_LABEL[k]}: "${best.value}" vs "${other.value}"`);
  }
  // City/state/ZIP from the street address when it has them.
  const a = fields.address.match(/,\s*([A-Za-z .'-]+),\s*(Texas|TX)\.?\s*(\d{5})?/i);
  if (a) { fields.city = titleCase(a[1].trim()); fields.state = "TX"; if (a[3]) fields.zip = a[3]; }
  if (fields.credentials) { const l = fields.credentials.match(LICENSED)?.[1]; fields.credentials = l ? l.replace(/\b\w/g, (c) => c.toUpperCase()) : fields.credentials.split(/\s[—–-]\s?|—/)[0].trim(); }
  if (fields.city && !fields.address && !(cands.city ?? []).some((c) => c.score >= 3)) conflicts.push(`City: "${fields.city}" is only the area named on the page — confirm the city they work in`);
  if (fields.instagram && !fields.profileLink) fields.profileLink = `instagram.com/${fields.instagram}`;
  fields.instagram = fields.instagram ? handleOf(fields.instagram) : "";
  if (fields.email) fields.email = normalizeEmail(fields.email) || fields.email;
  if (fields.phone) fields.phone = normalizePhone(fields.phone) || fields.phone;
  if (/not shown|none listed|n\/a/i.test(fields.prices)) fields.prices = "";
  fields.deposit = fields.deposit.match(/\$\s?\d+(?:\.\d{2})?/)?.[0]?.replace(/\s/g, "") ?? "";
  fields.source = /instagram/i.test(fields.source) ? "Instagram" : /facebook/i.test(fields.source) ? "Facebook" : "";
  const found = PARSED_KEYS.filter((k) => fields[k]);
  return { fields, conflicts: [...new Set(conflicts)], found };
}

/** "KNZ BEAUTY BAR" → "KNZ Beauty Bar" (vowel-less words like KNZ or DFW stay capitals); mixed-case text is kept as written. */
function titleCase(s: string) {
  const t = s.trim();
  if (/[a-z]/.test(t) && /[A-Z]/.test(t)) return t;
  return t.toLowerCase().replace(/\b([a-z][a-z'’]*)\b/g, (w) => (/^[^aeiouy]{2,4}$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .replace(/\b(Of|And|The|At|To)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase());
}
