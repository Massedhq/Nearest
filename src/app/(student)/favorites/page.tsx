import Image from "next/image";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, favorites, professionalProfiles, cities } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { liveProWhere } from "@/lib/search";
import { TopBar } from "@/components/TopBar";
import { FavButton } from "@/components/FavButton";

export const metadata = { title: "Favorites" };

export default async function Favorites() {
  const { user } = await requireVerifiedStudent();
  const rows = await db
    .select({ p: professionalProfiles, city: cities.name })
    .from(favorites)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, favorites.proId))
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(and(eq(favorites.studentId, user.id), ...liveProWhere(null, "all")))
    .orderBy(desc(favorites.createdAt));
  return (
    <div className="scr">
      <TopBar title="Favorites" back="/account" />
      <div className="body">
        {rows.length === 0 && <p className="small muted p">Tap the heart on any professional to save them here.</p>}
        <div className="col" style={{ gap: 0 }}>
          {rows.map(({ p, city }) => (
            <div key={p.userId} className="item">
              {p.photoUrl ? <Image src={p.photoUrl} alt="" width={52} height={52} style={{ borderRadius: 26, objectFit: "cover" }} /> : <div className="avatar">{(p.businessName ?? "N").slice(0, 2).toUpperCase()}</div>}
              <Link href={`/p/${p.userId}`} className="grow" style={{ textDecoration: "none" }}><div className="b">{p.businessName}</div><div className="small muted">{city}</div></Link>
              <FavButton proId={p.userId} on />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
