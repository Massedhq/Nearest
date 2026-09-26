import type { CityGroup } from "@/lib/city-groups";

/** <option>s for a city dropdown, grouped by market. */
export function CityOptions({ groups }: { groups: CityGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
    </>
  );
}
