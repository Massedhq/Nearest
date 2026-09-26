export function validName(s: string) {
  return s.length >= 1 && s.length <= 60;
}

export function validDob(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return years > 5 && years < 110;
}

/** Whole years of age from YYYY-MM-DD. */
export function ageFrom(dob: string, now = new Date()) {
  const [y, m, d] = dob.split("-").map(Number);
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) age--;
  return age;
}
