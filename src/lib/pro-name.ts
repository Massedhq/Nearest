/** The professional's own name shown to students (separate from their business name). */
export function personName(displayName: string | null | undefined, first?: string | null, last?: string | null) {
  const d = displayName?.trim();
  if (d) return d;
  return [first?.trim(), last?.trim() ? `${last.trim()[0]}.` : ""].filter(Boolean).join(" ") || "Your professional";
}
