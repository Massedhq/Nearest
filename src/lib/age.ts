/** Age in years from a YYYY-MM-DD birthday (Central time "today"). Unknown birthday → treated as under 18 for 18+ services. */
export function ageFrom(dob: string | null | undefined): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}
export const isAdult = (dob: string | null | undefined) => (ageFrom(dob) ?? 0) >= 18;
