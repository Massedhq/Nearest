import "server-only";

/** Looks up map coordinates for a US street address using the free U.S. Census geocoder (no key needed). */
export async function geocode(street: string, city: string, zip: string): Promise<{ lat: number; lng: number } | null> {
  const address = `${street}, ${city}, TX ${zip}`;
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { addressMatches?: { coordinates: { x: number; y: number } }[] } };
    const m = data.result?.addressMatches?.[0];
    return m ? { lat: m.coordinates.y, lng: m.coordinates.x } : null;
  } catch {
    return null;
  }
}

/** Distance in feet between two points (haversine). */
export function distanceFt(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 20_902_231; // Earth radius in feet
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Phones report location with an accuracy radius. We count someone as "there" when they're inside the
 * check-in radius, or when the reading is decent (≤ 200 ft) and the radius overlaps the location.
 * Every reading is stored so disputes can be reviewed.
 */
export function withinRadius(distance: number, accuracyFt: number, radiusFt: number) {
  return distance <= radiusFt || (accuracyFt <= 200 && distance - accuracyFt <= radiusFt);
}
