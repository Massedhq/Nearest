import "server-only";
import type { ProspectInput } from "./outreach";

/**
 * Turn an uploaded list into prospect rows. Spreadsheets (Excel / CSV) map columns by name, whatever they're called;
 * Word, PDF and pasted text are read line by line, pulling out emails and phone numbers.
 */
export async function parseProspectFile(name: string, buf: Buffer): Promise<ProspectInput[]> {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["xlsx", "xls", "csv", "tsv"].includes(ext)) return parseSheet(buf);
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    return parseText((await mammoth.extractRawText({ buffer: buf })).value);
  }
  if (ext === "pdf") return parseText(await pdfLines(buf));
  return parseText(buf.toString("utf8"));
}

const COLS: [keyof ProspectInput, RegExp][] = [
  ["email", /e-?mail/i], ["phone", /phone|mobile|cell|number|tel/i], ["business", /business|salon|shop|company|studio|brand/i],
  ["name", /name|professional|first|contact|owner|stylist|^pro$/i], ["city", /city|town|location/i], ["state", /^state$|^st$/i],
  ["category", /category|service|specialt|type|trade|craft/i], ["source", /source|found|where|platform/i], ["notes", /note|comment|detail/i],
];

async function parseSheet(buf: Buffer): Promise<ProspectInput[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "buffer" });
  const out: ProspectInput[] = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
    if (!rows.length) continue;
    const headers = Object.keys(rows[0]);
    const map = new Map<string, keyof ProspectInput>();
    for (const h of headers) {
      const hit = COLS.find(([field, re]) => re.test(h.trim()) && ![...map.values()].includes(field));
      if (hit) map.set(h, hit[0]);
    }
    const last = headers.find((h) => /last/i.test(h));
    for (const r of rows) {
      const p: ProspectInput = { name: "" };
      for (const [h, field] of map) {
        const v = String(r[h] ?? "").trim();
        if (v) (p as Record<string, string>)[field] = v;
      }
      if (last && r[last] && p.name && !p.name.includes(" ")) p.name = `${p.name} ${String(r[last]).trim()}`;
      // Unlabeled columns: still catch emails / phones anywhere in the row.
      const all = Object.values(r).map(String).join(" ");
      p.email ||= all.match(EMAIL)?.[0];
      p.phone ||= all.match(PHONE)?.[0];
      if (!p.name) p.name = p.business || p.email?.split("@")[0] || "";
      if (p.name || p.email || p.phone) out.push(p);
    }
  }
  return out;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

/** PDF → text with each printed line kept on its own line (items grouped by their vertical position). */
async function pdfLines(buf: Buffer): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as { str?: string; transform?: number[] }[]) {
      if (!it.str || !it.transform) continue;
      const y = Math.round(it.transform[5] / 3) * 3; // same line ≈ same y
      const row = rows.get(y) ?? [];
      row.push({ x: it.transform[4], s: it.str });
      rows.set(y, row);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) lines.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.s).join(" ").replace(/\s+/g, " ").trim());
  }
  return lines.join("\n");
}

const STATES: Record<string, string> = { tx: "TX", texas: "TX", fl: "FL", florida: "FL", ga: "GA", georgia: "GA", ok: "OK", oklahoma: "OK", la: "LA", louisiana: "LA", ca: "CA", california: "CA", ny: "NY", "new york": "NY", az: "AZ", arizona: "AZ", nc: "NC", "north carolina": "NC", al: "AL", alabama: "AL", tn: "TN", tennessee: "TN", ms: "MS", mississippi: "MS", ar: "AR", arkansas: "AR", co: "CO", colorado: "CO", il: "IL", illinois: "IL", nv: "NV", nevada: "NV", sc: "SC", "south carolina": "SC", va: "VA", virginia: "VA", md: "MD", maryland: "MD", oh: "OH", ohio: "OH", mi: "MI", michigan: "MI", pa: "PA", pennsylvania: "PA", nj: "NJ", "new jersey": "NJ", wa: "WA", washington: "WA" };
const TRADE = /\b(nail ?tech|nails?|manicur\w*|pedicur\w*|lash(?:es| tech| artist)?|brows?|braid(?:s|er|ing)?|locs?|loctician|barber|makeup(?: artist)?|mua|esthetician|skincare|facials?|hair ?stylist|stylist|hair|wax(?:ing)?|massage|tattoo\w*|pierc\w*|cosmetolog\w*|photograph\w*|fitness|trainer)\b/i;
const BIZ = /\b(nails|salon|studio|beauty|braids|lashes|bar|lounge|spa|co|llc|boutique|suite|parlor|barbershop|glam|collective)\b|'s\b/i;
const LEAD = /^(call|text|dm|contact|email|reach out to|ask for)\s+/i;

function parseText(text: string): ProspectInput[] {
  // Labeled blocks ("Name: …" / "Email: …") separated by blank lines; otherwise one prospect per line.
  const labeled = /(^|\n)\s*name\s*:/i.test(text);
  const blocks = labeled ? text.split(/\n\s*\n/) : text.split(/\n/);
  const out: ProspectInput[] = [];
  for (const raw of blocks) {
    const b = raw.replace(/\s+/g, " ").trim();
    if (!b) continue;
    const email = b.match(EMAIL)?.[0] ?? null;
    const phone = b.match(PHONE)?.[0] ?? null;
    if (!email && !phone) continue; // headings and lines without a way to reach them
    const label = (re: RegExp) => b.match(re)?.[1]?.trim() || null;
    if (labeled) {
      out.push({ name: label(/name\s*:\s*([^|;\n]+?)(?=\s+\w+\s*:|$)/i) ?? (email ? email.split("@")[0] : ""), business: label(/(?:business|salon|studio)\s*:\s*([^|;\n]+?)(?=\s+\w+\s*:|$)/i), city: label(/city\s*:\s*([^|;,\n]+?)(?=\s+\w+\s*:|,|$)/i), state: label(/state\s*:\s*([A-Za-z ]+?)(?=\s+\w+\s*:|$)/i), category: label(/(?:category|service|specialty)\s*:\s*([^|;\n]+?)(?=\s+\w+\s*:|$)/i), email, phone, notes: label(/notes?\s*:\s*(.+)$/i) });
      continue;
    }
    let rest = b.replace(EMAIL, " ").replace(PHONE, " ");
    // Category in parentheses, e.g. "Tasha Green (Barber)".
    let category: string | null = null;
    rest = rest.replace(/\(([^)]{2,40})\)/g, (_, inner: string) => { if (!category && TRADE.test(inner)) category = inner.trim(); return " "; });
    // "City, ST" / "City ST" / "City, Texas".
    let city: string | null = null, state: string | null = null;
    const cs = rest.match(/((?:[A-Z][A-Za-z.']+\s?){1,3}?),?\s+(TX|Texas|FL|Florida|GA|Georgia|OK|LA|CA|NY|AZ|NC|AL|TN|MS|AR|CO|IL|NV|SC|VA|MD|OH|MI|PA|NJ|WA)\b/);
    if (cs) { city = cs[1].trim(); state = STATES[cs[2].toLowerCase()] ?? cs[2].toUpperCase(); rest = rest.replace(cs[0], " "); }
    const parts = rest.split(/\s*(?:\||,|;|\t|•| – | — | - )\s*/).map((x) => x.replace(/^[\s\-–—|,;:]+|[\s\-–—|,;:]+$/g, "").replace(LEAD, "").trim()).filter((x) => x && !/^(email|phone|e-mail|tel|cell)\s*:?$/i.test(x));
    if (!category) {
      const i = parts.findIndex((x, n) => n > 0 && TRADE.test(x) && !BIZ.test(x));
      if (i > 0) category = parts.splice(i, 1)[0];
    }
    const name = parts.shift() ?? (email ? email.split("@")[0] : "");
    const bi = parts.findIndex((x) => BIZ.test(x));
    const business = bi >= 0 ? parts.splice(bi, 1)[0] : null;
    if (!city && parts.length && /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}$/.test(parts[0]) && !TRADE.test(parts[0])) city = parts.shift()!;
    if (!category && business && TRADE.test(business)) category = business.match(TRADE)![0];
    out.push({ name, business, city, state, category, email, phone, notes: parts.length ? parts.join(", ") : null });
  }
  return out;
}
