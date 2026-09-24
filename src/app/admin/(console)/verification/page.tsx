import Image from "next/image";
import { asc, eq } from "drizzle-orm";
import { db, users, professionalProfiles, proServices, proCredentials, categories, cities, portfolioItems } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { RejectForm } from "@/components/RejectForm";
import { requireAdmin } from "@/lib/admin";
import { approvePro, setCredential } from "@/app/admin/pro-actions";
import { money } from "@/lib/time";

export const metadata = { title: "Verification Queue" };

export default async function Verification() {
  await requireAdmin();
  const [pending, creds] = await Promise.all([
    db
      .select({ p: professionalProfiles, u: users, city: cities.name })
      .from(professionalProfiles)
      .innerJoin(users, eq(users.id, professionalProfiles.userId))
      .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
      .where(eq(professionalProfiles.reviewStatus, "submitted"))
      .orderBy(asc(professionalProfiles.submittedAt)),
    db
      .select({ c: proCredentials, u: users, cat: categories.name, biz: professionalProfiles.businessName })
      .from(proCredentials)
      .innerJoin(users, eq(users.id, proCredentials.userId))
      .innerJoin(categories, eq(categories.id, proCredentials.categoryId))
      .innerJoin(professionalProfiles, eq(professionalProfiles.userId, proCredentials.userId))
      .where(eq(proCredentials.status, "pending"))
      .orderBy(asc(proCredentials.createdAt)),
  ]);
  const details = await Promise.all(
    pending.map(async ({ p }) => ({
      services: await db.select().from(proServices).where(eq(proServices.userId, p.userId)).orderBy(asc(proServices.sort)),
      photos: await db.select({ url: portfolioItems.url }).from(portfolioItems).where(eq(portfolioItems.userId, p.userId)).limit(6),
    })),
  );

  return (
    <>
      <AdminHead eyebrow={`${pending.length} profile${pending.length === 1 ? "" : "s"} • ${creds.length} license${creds.length === 1 ? "" : "s"}`} title="Verification Queue" />
      <div className="card" style={{ gap: 12, overflowX: "auto" }}>
        <span className="eyebrow">Licenses to check</span>
        <p className="xs muted p">Look each one up on the TDLR license search, then mark it.</p>
        <table className="tbl">
          <thead><tr><th>Professional</th><th>Category</th><th>License</th><th>Number</th><th>State</th><th>Expires</th><th /></tr></thead>
          <tbody>
            {creds.length === 0 && <tr><td className="empty" colSpan={7}>No licenses waiting.</td></tr>}
            {creds.map(({ c, u, cat, biz }) => (
              <tr key={c.id}>
                <td>{biz ?? `${u.firstName} ${u.lastName}`}<div className="xs muted">{u.firstName} {u.lastName}</div></td>
                <td>{cat}</td><td>{c.licenseType}</td><td className="num">{c.licenseNumber}</td><td>{c.issuingState}</td><td>{c.expiresOn ?? "—"}</td>
                <td>
                  <div className="row">
                    <form action={setCredential}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="verified" /><button className="btn sm" type="submit">Verified</button></form>
                    <form action={setCredential}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="rejected" /><button className="btn danger sm" type="submit">Can&apos;t verify</button></form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <span className="eyebrow">Profiles submitted for review</span>
      {pending.length === 0 && <div className="card"><span className="small muted">No profiles waiting.</span></div>}
      {pending.map(({ p, u, city }, i) => (
        <div key={p.userId} className="card" style={{ gap: 14 }}>
          <div className="row between">
            <div className="row">
              {p.photoUrl ? <Image src={p.photoUrl} alt="" width={52} height={52} style={{ borderRadius: 26, objectFit: "cover" }} /> : <div className="avatar">{(p.businessName ?? "?").slice(0, 2).toUpperCase()}</div>}
              <div><div className="b">{p.businessName}</div><div className="xs muted">{u.firstName} {u.lastName} • {u.email} • {city ?? "No city"} • {p.cohort}</div></div>
            </div>
            <form action={approvePro}><input type="hidden" name="userId" value={p.userId} /><button className="btn sm" type="submit">Approve &amp; go live</button></form>
          </div>
          <div className="acols even">
            <div className="col" style={{ gap: 6 }}>
              <span className="lbl">About</span><p className="small p">{p.bio}</p>
              <span className="lbl">Services</span>
              {details[i].services.map((s) => <div key={s.id} className="row between small"><span>{s.name}</span><span>{money(s.priceCents)} • {s.durationMin} min</span></div>)}
              <span className="lbl">Links</span>
              <span className="small">{[p.instagram && `IG @${p.instagram}`, p.tiktok && `TikTok @${p.tiktok}`, p.website].filter(Boolean).join(" • ") || "—"}</span>
            </div>
            <div className="col" style={{ gap: 8 }}>
              <div className="grid3">{details[i].photos.map((ph) => <div key={ph.url} className="ph" style={{ height: 90, padding: 0 }}><Image src={ph.url} alt="" fill sizes="120px" style={{ objectFit: "cover" }} /></div>)}</div>
              <RejectForm userId={p.userId} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
