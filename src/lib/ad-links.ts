/** Campaign name → the utm_campaign value used in ad links (shared by the link picker and the spend form). */
export const adSlug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "vote";
