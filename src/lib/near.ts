import "server-only";
import { cookies } from "next/headers";

/** The student's rough location from the Near Me cookie (set on their device), or null. */
export async function nearPoint() {
  const v = (await cookies()).get("nearest_loc")?.value;
  const m = v?.match(/^(-?\d{1,2}\.\d{1,4}),(-?\d{1,3}\.\d{1,4})$/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

export function miles(a: { lat: number; lng: number }, b: { lat: number | null; lng: number | null }) {
  if (b.lat == null || b.lng == null) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 3958.8 * Math.asin(Math.sqrt(h)) * 10) / 10;
}
