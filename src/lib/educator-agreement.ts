/**
 * Training Video Production, License & Confidentiality Agreement (2026-11-23). Plain data, used by the send form, the
 * creator's signing page (/agreement/[token]) and the signed copy. Change EDUCATOR_AGREEMENT_VERSION whenever the
 * text changes — every contract stores the version it was signed under.
 */
export const EDUCATOR_AGREEMENT_VERSION = "2026-11-23";
export const EDUCATOR_AGREEMENT_TITLE = "Training Video Production, License & Confidentiality Agreement";
export const NEAREST_PARTY = { name: "Nearest, LLC", address: "5729 Lebanon Rd #144605, Frisco, Texas 75034" };

/** The creator's part. `who` = who fills it: the assistant when sending, the creator may correct it when signing. */
export const AGREEMENT_FIELDS = [
  { key: "legal", label: "Creator legal name", required: true },
  { key: "business", label: "Business name (if any)", required: false },
  { key: "handle", label: "Social handle(s)", required: false },
  { key: "contact", label: "Phone / email", required: true },
  { key: "subject", label: "Video subject", required: true, hint: "for example: classic lash full set, start to finish" },
  { key: "length", label: "Approximate length (minutes)", required: true },
  { key: "due", label: "Delivery date", required: true },
  { key: "fee", label: "Fee", required: true },
  { key: "links", label: "Links to credit", required: false, hint: "Instagram, TikTok, booking page" },
] as const;
export type AgreementFields = Record<(typeof AGREEMENT_FIELDS)[number]["key"], string>;

export const AGREEMENT_SECTIONS: { title: string; body: string[] }[] = [
  { title: "1. Parties and the video", body: [
    "This agreement is between Nearest, LLC, 5729 Lebanon Rd #144605, Frisco, Texas 75034 (\"Nearest\"), and the Creator named above (\"Creator\").",
    "The \"Video\" means the finished training video described above, plus all raw footage, photos, audio, captions, product lists and written notes the Creator makes for it.",
  ] },
  { title: "2. Payment", body: [
    "Nearest pays the Fee in two parts: 50% within 5 business days of signing and 50% within 10 business days after Nearest accepts the finished Video under section 5. Nearest pays by bank transfer, Zelle, or another method both sides agree to in writing.",
    "The Fee is the full price for the Video and every right in section 3. There are no royalties, revenue shares or per-sale payments unless both sides sign a written change to this agreement.",
    "The Creator is an independent contractor, not an employee, and handles their own taxes. Nearest may ask for a W-9 before paying and may issue a 1099 as required by law. If the Creator does not deliver the Video, the Creator returns the first payment within 15 days.",
  ] },
  { title: "3. Ownership and the right to sell and resell", body: [
    "Nearest owns the Video once the first payment is made. To the extent the law allows, the Video is a \"work made for hire\" for Nearest. To the extent it is not, the Creator assigns (transfers) to Nearest all copyright and other rights in the Video, worldwide, forever.",
    "Without further approval or payment, Nearest and anyone it authorizes may copy, edit, cut, caption, translate and re-format the Video; sell, resell, rent, license and sublicense it, alone or in bundles, courses or memberships, at any price Nearest sets; stream, download, display and distribute it on the Nearest platform, apps, websites and any other channel; and use clips, stills and the Creator's name, handle and likeness from the Video to advertise and promote it and Nearest.",
    "The Creator may not sell, post or share this Video, or a copy of it, anywhere else. The Creator keeps the right to teach the same techniques and make different videos of their own.",
  ] },
  { title: "4. Credit and feature", body: [
    "Wherever Nearest offers the Video, it credits the Creator by name or business name and shows the links the Creator provides, so viewers know where to find and book them. Nearest decides how the credit looks. A small mistake in a credit is fixed within 10 business days of written notice and is not a breach.",
  ] },
  { title: "5. What the Video must include", body: [
    "The Creator delivers the Video by the delivery date as an MP4 file, at least 1080p, with clear sound. It must: (1) show the full service step by step, start to finish, with the Creator explaining each step out loud; (2) name and show every product and tool used (brand and product name), and include a written list of them; (3) show safe, clean practices; (4) use no music, logos or footage the Creator does not have the right to use; (5) include only people who have signed a model release (the Creator supplies the signed releases).",
    "Nearest has 10 business days to review. Nearest may ask for one round of reasonable fixes, which the Creator makes within 7 days at no extra cost. The Video is accepted when Nearest says so in writing (email or in-app), or after 10 business days with no request for fixes.",
  ] },
  { title: "6. Confidentiality (non-disclosure)", body: [
    "The Creator keeps Nearest's Confidential Information private and uses it only to make the Video. \"Confidential Information\" means anything Nearest shares that is not public, including the Fee and the terms of this agreement; how and where Nearest will offer, price, bundle or sell the Video; Nearest's plans, programs, partners, customers, professionals, students, data and unreleased features; and the Video itself and its raw footage until Nearest releases it.",
    "This does not cover information that is already public (through no fault of the Creator), that the Creator already knew, or that the law or a court requires the Creator to share (after telling Nearest first, where allowed). The Creator may tell their own lawyer, accountant or tax preparer, who must keep it private too.",
    "These duties last 3 years after signing, and forever for the Fee and the agreement's terms. Once Nearest releases the Video publicly, the Creator may say they made a video for Nearest. If the Creator breaks this section, Nearest may ask a court to stop it right away, in addition to any other remedy.",
  ] },
  { title: "7. Creator's promises", body: [
    "The Creator promises that the Video is their own original work and does not copy anyone else's; they have the right to sign this agreement and give Nearest these rights, and have not given them to anyone else; everyone shown in the Video signed a model release, and anyone under 18 has a parent or guardian's signed release; and nothing in the Video breaks any law or anyone's rights.",
    "The Creator will cover Nearest's losses and reasonable legal costs if any of these promises turns out to be untrue. Nearest is not responsible for the Creator's tools, travel, products or costs to make the Video unless both sides agree in writing.",
  ] },
  { title: "8. General terms", body: [
    "Either side may end this agreement in writing if the other breaks it and does not fix it within 10 days of notice. Sections 3, 4, 6 and 7 stay in force for anything already delivered or paid for.",
    "This is the full agreement about the Video. Changes count only if both sides sign them. Texas law applies, and any dispute goes to the state or federal courts in Collin County, Texas.",
    "Signing online (typed name with date, time and IP address recorded) is the same as signing on paper. Copies count as originals. The Creator may not transfer this agreement without Nearest's written OK. Nearest may transfer it, and its rights in the Video, to anyone.",
  ] },
];

/** Plain text of a contract (stored copy, emails). */
export function agreementText(f: Partial<AgreementFields>, sig: { nearest: string; nearestTitle: string; nearestAt: string; creator?: string | null; creatorAt?: string | null }) {
  const lines = [EDUCATOR_AGREEMENT_TITLE, `Version ${EDUCATOR_AGREEMENT_VERSION}`, "", `Nearest: ${NEAREST_PARTY.name}, ${NEAREST_PARTY.address}`];
  for (const x of AGREEMENT_FIELDS) lines.push(`${x.label}: ${f[x.key] || "—"}`);
  lines.push("");
  for (const s of AGREEMENT_SECTIONS) lines.push(s.title, ...s.body, "");
  lines.push(`Signed for Nearest: ${sig.nearest}, ${sig.nearestTitle} — ${sig.nearestAt}`);
  lines.push(`Signed by Creator: ${sig.creator || "—"}${sig.creatorAt ? ` — ${sig.creatorAt}` : ""}`);
  return lines.join("\n");
}
