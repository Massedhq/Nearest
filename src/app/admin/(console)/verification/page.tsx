import Image from "next/image";
import { asc, eq, sql } from "drizzle-orm";
import { db, users, professionalProfiles, proServices, cities, portfolioItems, studentProfiles, schools, schoolRequests, studentIdDocs } from "@/db";
import { and } from "drizzle-orm";
import { StudentReject } from "@/components/StudentReject";
import { approveStudent, approveProId } from "@/app/admin/student-actions";
import { ProIdReject } from "@/components/ProIdReject";
import { AdminHead } from "@/components/AdminHead";
import { RejectForm } from "@/components/RejectForm";
import { requireAdmin } from "@/lib/admin";
import { MAX_PRICE_CENTS } from "@/lib/pricing";
import { instagramHandle, tiktokHandle, instagramUrl, tiktokUrl } from "@/lib/social";
import { approvePro } from "@/app/admin/pro-actions";
import { money } from "@/lib/time";

export const metadata = { title: "Verification Queue" };

export default async function Verification() {
  await requireAdmin();
  const [pending, studentsPending] = await Promise.all([
    db
      .select({ p: professionalProfiles, u: users, city: cities.name })
      .from(professionalProfiles)
      .innerJoin(users, eq(users.id, professionalProfiles.userId))
      .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
      .where(eq(professionalProfiles.reviewStatus, "submitted"))
      .orderBy(asc(professionalProfiles.submittedAt)),
    db
      .select({ s: studentProfiles, u: users, school: schools.name, reqName: schoolRequests.name, reqCity: schoolRequests.cityName })
      .from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .leftJoin(schools, eq(schools.id, studentProfiles.schoolId))
      .leftJoin(schoolRequests, and(eq(schoolRequests.userId, studentProfiles.userId), eq(schoolRequests.status, "pending")))
      .where(eq(studentProfiles.verificationStatus, "pending"))
      .orderBy(asc(studentProfiles.idSubmittedAt)),
  ]);
  const age = (dob: string | null) => (dob ? Math.floor((Date.now() - new Date(`${dob}T12:00:00Z`).getTime()) / (365.25 * 86400000)) : null);
  const proIds = await db.select({ userId: professionalProfiles.userId, first: users.firstName, last: users.lastName, email: users.email, dob: users.dateOfBirth, business: professionalProfiles.businessName })
    .from(professionalProfiles).innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(and(eq(professionalProfiles.identityStatus, "pending"), sql`exists (select 1 from ${studentIdDocs} d where d.user_id = ${professionalProfiles.userId} and d.kind = 'gov_id')`));
  const details = await Promise.all(
    pending.map(async ({ p }) => ({
      services: await db.select().from(proServices).where(eq(proServices.userId, p.userId)).orderBy(asc(proServices.sort)),
      photos: await db.select({ url: portfolioItems.url }).from(portfolioItems).where(and(eq(portfolioItems.userId, p.userId), eq(portfolioItems.kind, "image"))).limit(6),
    })),
  );

  return (
    <>
      <AdminHead eyebrow={`${studentsPending.length} student${studentsPending.length === 1 ? "" : "s"} • ${pending.length} profile${pending.length === 1 ? "" : "s"}`} title="Verification Queue" />
      <span className="eyebrow">Professional IDs</span>
      {proIds.length === 0 && <div className="card"><span className="small muted">No professional IDs waiting.</span></div>}
      {proIds.map((p) => (
        <div key={p.userId} className="card" style={{ gap: 12 }}>
          <div className="row between">
            <div><div className="b">{p.first} {p.last}</div><div className="xs muted">{p.business ?? "Business not named yet"} • {p.email} • age {age(p.dob) ?? "?"}</div></div>
            <form action={approveProId}><input type="hidden" name="userId" value={p.userId} /><button className="btn sm" type="submit">Verify ID</button></form>
          </div>
          <div className="acols even">
            <div className="grid2">
              <figure style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/id-doc/${p.userId}/gov_id`} alt="Driver's license or state ID" style={{ width: "100%", borderRadius: 10, border: "1px solid #2A2A2D" }} />
                <figcaption className="xs muted">Driver&apos;s license / state ID (view logged)</figcaption>
              </figure>
              <figure style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/id-doc/${p.userId}/selfie`} alt="Selfie" style={{ width: "100%", borderRadius: 10, border: "1px solid #2A2A2D" }} />
                <figcaption className="xs muted">Selfie (view logged)</figcaption>
              </figure>
            </div>
            <ProIdReject userId={p.userId} />
          </div>
          <p className="xs muted p">Check the name matches their account ({p.first} {p.last}), the ID is current, and the selfie matches the ID photo. Photos are deleted as soon as you decide.</p>
        </div>
      ))}
      <span className="eyebrow">Students</span>
      {studentsPending.length === 0 && <div className="card"><span className="small muted">No students waiting.</span></div>}
      {studentsPending.map(({ s, u, school, reqName, reqCity }) => (
        <div key={s.userId} className="card" style={{ gap: 12 }}>
          <div className="row between">
            <div><div className="b">{u.firstName} {u.lastName}</div><div className="xs muted">{u.email} • age {age(u.dateOfBirth) ?? "?"} • class of {s.graduationYear}</div></div>
            {school ? (
              <form action={approveStudent}><input type="hidden" name="userId" value={s.userId} /><button className="btn sm" type="submit">Verify student</button></form>
            ) : (
              <a className="btn ghost sm" href="/admin/schools">Add their school first</a>
            )}
          </div>
          <div className="row small"><span className="muted">School:</span> {school ?? <span className="tag warn">Requested: {reqName} ({reqCity})</span>}</div>
          {s.schoolEmailVerifiedAt && (
            <div className="card ok small" style={{ gap: 2 }}>
              <span><span className="b">School email verified:</span> {s.schoolEmail}</span>
              <span className="muted">They confirmed a code sent to this email and have temporary access now. Approve to make it permanent, or reject to remove access.</span>
            </div>
          )}
          <div className="acols even">
            <div className="grid2">
              {s.idSubmittedAt ? (
                <figure style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/admin/id-doc/${s.userId}/school_id`} alt="School ID" style={{ width: "100%", borderRadius: 10, border: "1px solid #2A2A2D" }} />
                  <figcaption className="xs muted">School ID (view logged)</figcaption>
                </figure>
              ) : (
                <div className="card small"><span className="muted">No school ID — verified by school email.</span></div>
              )}
              <figure style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/id-doc/${s.userId}/selfie`} alt="Selfie" style={{ width: "100%", borderRadius: 10, border: "1px solid #2A2A2D" }} />
                <figcaption className="xs muted">Selfie (view logged)</figcaption>
              </figure>
            </div>
            <StudentReject userId={s.userId} />
          </div>
          <p className="xs muted p">Check the name and school match, the ID looks current, and the selfie matches the ID photo. Photos are deleted as soon as you decide.</p>
        </div>
      ))}

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
              {details[i].services.map((s) => <div key={s.id} className="row between small"><span>{s.name}</span><span>{s.priceCents > MAX_PRICE_CENTS && <span className="tag bad" style={{ marginRight: 6 }}>Over $150</span>}{money(s.priceCents)} • {s.durationMin} min</span></div>)}
              <span className="lbl">Links</span>
              <span className="small row" style={{ gap: 12, flexWrap: "wrap" }}>
                {!p.instagram && !p.tiktok && "—"}
                {p.instagram && instagramHandle(p.instagram) && <a className="link small" href={instagramUrl(instagramHandle(p.instagram)!)} target="_blank" rel="noopener noreferrer">Instagram @{instagramHandle(p.instagram)} ↗</a>}
                {p.tiktok && tiktokHandle(p.tiktok) && <a className="link small" href={tiktokUrl(tiktokHandle(p.tiktok)!)} target="_blank" rel="noopener noreferrer">TikTok @{tiktokHandle(p.tiktok)} ↗</a>}
              </span>
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
