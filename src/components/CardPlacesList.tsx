import { publicPlaces } from "@/lib/card-places";

/** Where to get a Nearest Card: places that still have cards, by city. Shown on the QR page and Cards & activations. */
export async function CardPlacesList({ title = "Where to get a Nearest Card" }: { title?: string }) {
  const places = await publicPlaces();
  const byCity = new Map<string, typeof places>();
  for (const p of places) {
    const k = p.city ?? "Other";
    byCity.set(k, [...(byCity.get(k) ?? []), p]);
  }
  return (
    <div className="card small" style={{ gap: 8 }}>
      <span className="b">{title}</span>
      {places.length === 0 ? (
        <span className="muted">No places have cards right now. Check back soon — or ask a friend with Nearest for their invite link.</span>
      ) : (
        <>
          <span className="muted">Nearest Cards are given out at these places while they last. One card per student.</span>
          {[...byCity.entries()].map(([city, list]) => (
            <div key={city} className="col" style={{ gap: 4 }}>
              <span className="eyebrow" style={{ marginTop: 4 }}>{city}</span>
              {list.map((p) => (
                <div key={p.id} className="col" style={{ gap: 0 }}>
                  <span className="b">{p.name}</span>
                  <span className="xs muted">{p.kind}{p.address ? ` • ${p.address}` : ""}</span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
