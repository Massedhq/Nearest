/**
 * Is this a school email? No domain list to maintain: it must end in .edu, .net, .org or .us, or the domain
 * contains "isd" (like lisd) — and it can't be a personal email provider (including internet-provider .net emails).
 */
const PERSONAL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com", "aol.com", "aim.com", "hotmail.com", "outlook.com",
  "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "zoho.com", "zohomail.com", "proton.me", "protonmail.com", "pm.me",
  "gmx.com", "gmx.net", "mail.com", "yandex.com", "tutanota.com", "fastmail.com", "hey.com",
  // internet-provider personal emails
  "att.net", "sbcglobal.net", "bellsouth.net", "comcast.net", "verizon.net", "charter.net", "cox.net", "earthlink.net",
  "frontier.net", "frontiernet.net", "windstream.net", "centurylink.net", "optonline.net", "suddenlink.net", "juno.com", "netzero.net", "spectrum.net",
]);

export function schoolEmailProblem(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) return "Enter your full school email address.";
  const domain = email.split("@")[1];
  if (PERSONAL.has(domain) || [...PERSONAL].some((p) => domain.endsWith(`.${p}`))) return "Use your school email, not a personal one (Gmail, Yahoo, AOL, Hotmail and so on).";
  const tld = domain.split(".").pop()!;
  if (["edu", "net", "org", "us"].includes(tld) || domain.includes("isd")) return null;
  return "That doesn't look like a school email. School emails usually end in .edu, .net, .org or .us.";
}
