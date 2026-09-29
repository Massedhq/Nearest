"use client";
import { useState } from "react";
import type { CityGroup } from "@/lib/city-groups";
import { CityOptions } from "./CityOptions";
import { AddressAutocomplete } from "./AddressAutocomplete";

/** Pro service address: street (with suggestions), Apt/Suite/Unit, City, State and ZIP as separate fields. */
export function ProAddressFields({ groups, address, unit, cityId, zip, state = "TX" }: { groups: CityGroup[]; address: string; unit: string; cityId: number | null; zip: string; state?: string }) {
  const [city, setCity] = useState(cityId ? String(cityId) : "");
  const [z, setZ] = useState(zip);
  const [st, setSt] = useState(state);
  const [note, setNote] = useState("");
  return (
    <div className="col" style={{ gap: 12 }}>
      <AddressAutocomplete id="address" name="address" label="Street address (private)" defaultValue={address}
        onPick={(a) => {
          if (a.zip) setZ(a.zip);
          if (a.state) setSt(a.state);
          const match = groups.flatMap((g) => g.cities).find((c) => c.name.toLowerCase() === a.city.toLowerCase());
          if (match) { setCity(String(match.id)); setNote(""); }
          else if (a.city) setNote(`${a.city} isn't in Nearest's city list yet — choose the closest city below.`);
        }} />
      <div className="field"><label htmlFor="unit">Apt, suite, unit (optional)</label><input id="unit" name="unit" defaultValue={unit} placeholder="Apt 4B, Suite 120" autoComplete="address-line2" /></div>
      <div className="field"><label htmlFor="cityId">City</label>
        <select id="cityId" name="cityId" value={city} onChange={(e) => setCity(e.target.value)} required>
          <option value="" disabled>Choose city</option>
          <CityOptions groups={groups} />
        </select>
        {note && <span className="xs err">{note}</span>}
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="state">State</label><input id="state" name="state" value={st} readOnly aria-readonly="true" /></div>
        <div className="field"><label htmlFor="zip">ZIP</label><input id="zip" name="zip" inputMode="numeric" maxLength={5} value={z} onChange={(e) => setZ(e.target.value.replace(/\D/g, "").slice(0, 5))} required autoComplete="postal-code" /></div>
      </div>
    </div>
  );
}
