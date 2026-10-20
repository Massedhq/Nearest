/**
 * Legal names must be a real person's name — never a business name and never derived from one.
 * Used wherever a professional's legal first/last name is entered (pro sign-up, Admin → Build a profile) and when a
 * business name is saved, so "Kweenz Nailz" can't become someone's legal name.
 *
 * Rules:
 *  1. Letters only (any language), plus spaces, hyphens, apostrophes and periods. No digits, emoji or symbols.
 *  2. No business or service words in a legal name (nails, lashes, beauty, studio, LLC, glam, kween…), including
 *     stylized spellings (Nailz, Lashez, Beautii, Glamm).
 *  3. Not the business name, and not built from it: if the legal name shares a word with the business name, that
 *     business name must be made only of the person's own name plus service words ("Heather's Lashes", "Nails by
 *     Tasha" are fine for Heather / Tasha). Otherwise the legal name was taken from the brand and is refused.
 */

const BUSINESS_WORDS = [
  "nail", "naild", "lash", "lashd", "brow", "beauty", "beautician", "salon", "studio", "spa", "glam", "glow", "hair", "hairstylist", "stylist",
  "braid", "braidd", "loc", "barbershop", "kut", "fade", "makeup", "mua", "esthetic", "esthetician", "esthetics", "skin", "skincare",
  "waxing", "threading", "boutique", "lounge", "artistry", "design", "designs", "collective", "llc", "inc", "co", "corp", "ltd",
  "company", "enterprise", "enterprises", "service", "kwen", "kwenz", "quen", "queen", "bos", "diva", "babe", "vibe", "slay", "slayd",
  "twist", "wig", "weave", "extension", "polish", "acrylic", "pedicure", "manicure", "mani", "pedi", "masage", "welnes",
  "therapy", "lux", "luxe", "luxury", "by", "the", "and", "oficial", "mobile", "suite", "cosmetology", "cosmetic", "cosmetics", "organic", "natural",
  "naturals", "glamour", "nailtech", "lashtech", "facial", "sugaring", "bodycare", "creations", "creation", "shop", "parlor", "parlour",
];

/** Lowercase, letters only, stylized endings and doubled letters folded: "Nailz" → "nail", "Beautii" → "beauty", "Glamm" → "glam". */
export function normWord(w: string): string {
  let s = w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  s = s.replace(/(ii|ie|ee)$/, "y"); // "Beautii" / "Beautie" → "beauty"
  s = s.replace(/(.)\1+/g, "$1"); // doubled letters
  if (s.length > 3) s = s.replace(/(z|s|es|ez)$/, ""); // plurals and "z" plurals
  return s;
}
const BUSINESS = new Set(BUSINESS_WORDS.map(normWord));
const words = (s: string) => s.split(/[\s\-_.,&/+|]+|'s\b|’s\b/i).map((w) => w.trim()).filter(Boolean);

/** Returns an error message, or null when the legal name is acceptable. */
export function legalNameProblem(first: string, last: string, businessName?: string | null, who: "you" | "they" = "you"): string | null {
  const your = who === "you" ? "your" : "their";
  const f = first.trim(), l = last.trim();
  if (!f || !l) return `Enter ${your} legal first and last name.`;
  if (f.length > 60 || l.length > 60) return "Names can be up to 60 characters.";
  const allowed = /^[\p{L}][\p{L}\p{M}\s'’.\-]*$/u;
  if (!allowed.test(f) || !allowed.test(l)) return `Use ${your} legal name exactly as it appears on ${your} government ID — letters only, no numbers, emoji or symbols.`;
  const legal = [...words(f), ...words(l)];
  const flagged = legal.find((w) => BUSINESS.has(normWord(w)));
  if (flagged) return `"${flagged}" looks like part of a business name. Enter ${your} legal first and last name as shown on ${your} government ID — ${your} business name goes on ${your} profile later.`;
  if (businessName && businessName.trim()) {
    const legalNorm = legal.map(normWord).filter(Boolean);
    const biz = words(businessName).map(normWord).filter(Boolean);
    const joined = (a: string[]) => a.join("");
    if (joined(legalNorm) === joined(biz)) return `${who === "you" ? "Your" : "Their"} legal name can't be ${your} business name. Use the name on ${your} government ID.`;
    const shared = legalNorm.some((w) => w.length >= 2 && biz.includes(w));
    if (shared) {
      const leftover = biz.filter((w) => !legalNorm.includes(w) && !BUSINESS.has(w));
      if (leftover.length) return `${who === "you" ? "Your" : "Their"} legal name looks like it was taken from the business name "${businessName.trim()}". Use the name on ${your} government ID.`;
    }
  }
  return null;
}
