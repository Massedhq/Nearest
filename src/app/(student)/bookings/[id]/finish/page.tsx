import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, bookings, professionalProfiles, reviews } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { finishOpen } from "@/lib/appointment";
import { money } from "@/lib/time";
import { Steps } from "@/components/Steps";
import { ActionForm } from "@/components/ActionForm";
import { ResultPhoto } from "@/components/ResultPhoto";
import { Icon } from "@/components/Icon";
import { finishStep } from "@/app/day-actions";

export const metadata = { title: "Finish your appointment" };

export default async function Finish({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { user } = await requireVerifiedStudent();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const row = (await db.select({ b: bookings, pro: professionalProfiles.businessName }).from(bookings).innerJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId)).where(and(eq(bookings.id, id), eq(bookings.studentId, user.id))).limit(1))[0];
  if (!row) notFound();
  const { b, pro } = row;
  const step = (await searchParams).step ?? "1";

  if (step === "done" || b.status === "completed") {
    return (
      <div className="scr">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 26px", textAlign: "center" }}>
          <div style={{ width: 108, height: 108, borderRadius: 54, border: "2px solid #ECE8E1", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size="xl" /></div>
          <h1 className="disp h1" style={{ fontSize: 42 }}>All done</h1>
          <p className="muted p">Your appointment is complete{b.transferId ? " and payment was released to your professional" : ""}.</p>
        </div>
        <div className="body" style={{ flex: "none", gap: 10 }}>
          <Link className="btn ghost" href={`/p/${b.proId}`}>Book {pro} again</Link>
          <Link className="btn" href="/home">Back to Explore</Link>
        </div>
      </div>
    );
  }
  if (!finishOpen(b)) redirect(`/bookings/${id}`);
  const reviewed = await db.query.reviews.findFirst({ where: eq(reviews.bookingId, b.id) });
  const n = Number(step);
  const total = b.chargedCents + b.creditProCents + b.creditGeneralCents;

  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Finish your appointment</div><span className="sp" /></div>
      <div className="body">
        <Steps at={n} total={4} />
        <p className="eyebrow p">Step {n} of 4</p>
        {n === 1 && (
          <>
            <h1 className="disp h1">How did your appointment go?</h1>
            <div className="card"><div className="b">{b.serviceName}</div><div className="small muted">{pro}</div></div>
            <p className="p">Was your scheduled service completed?</p>
            <ActionForm action={finishStep} submitLabel="Yes, service completed"><input type="hidden" name="id" value={b.id} /><input type="hidden" name="step" value="1" /></ActionForm>
            <Link className="btn danger" href={`/bookings/${b.id}/problem`}>No — report an issue</Link>
            <div className="card warn small"><div className="row top-a"><Icon name="alert" size="s" /><span className="grow">Please finish all four steps before you leave.</span></div></div>
          </>
        )}
        {n === 2 && (
          <>
            <h1 className="disp h1">Show us the results</h1>
            <p className="muted small p">Optional. A photo documents your appointment.</p>
            <ActionForm action={finishStep} submitLabel="Continue">
              <input type="hidden" name="id" value={b.id} /><input type="hidden" name="step" value="2" />
              <ResultPhoto userId={user.id} />
              <div className="card">
                <span className="b">Allow {pro} to show this photo on their Nearest portfolio?</span>
                <span className="small muted">Sharing publicly is a separate choice from taking the photo.</span>
                <div className="grid2">
                  <label className="check"><input type="radio" name="allow" value="yes" />Yes</label>
                  <label className="check"><input type="radio" name="allow" value="no" defaultChecked />No</label>
                </div>
              </div>
            </ActionForm>
          </>
        )}
        {n === 3 && (
          <>
            <h1 className="disp h1">How was your experience?</h1>
            <p className="muted small p">Be honest — pick the stars you actually mean.</p>
            {reviewed ? (
              <Link className="btn" href={`/bookings/${b.id}/finish?step=4`}>Continue</Link>
            ) : (
              <ActionForm action={finishStep} submitLabel="Submit review">
                <input type="hidden" name="id" value={b.id} /><input type="hidden" name="step" value="3" />
                <fieldset className="row" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
                  <legend className="lbl" style={{ marginBottom: 8 }}>Rating</legend>
                  {[1, 2, 3, 4, 5].map((r) => <label key={r} className="chip chipradio" style={{ height: 52, minWidth: 52, justifyContent: "center", fontSize: 16 }}><input type="radio" name="rating" value={r} required />{r}★</label>)}
                </fieldset>
                <div className="field"><label htmlFor="body">Tell us more (optional)</label><textarea id="body" name="body" maxLength={1000} /></div>
                <span className="badge small"><Icon name="check" size="s" /> Posted as a Verified Booking Review</span>
              </ActionForm>
            )}
          </>
        )}
        {n === 4 && (
          <>
            <h1 className="disp h1">Release payment</h1>
            <div className="card">
              <div className="row between"><span>{b.serviceName}</span><span className="num">{money(total)}</span></div>
              <hr className="hr" />
              <div className="row small"><Icon name="check" size="s" /> Service confirmed</div>
              <div className="row small"><Icon name="check" size="s" /> Photo step — portfolio sharing: {b.photoForPortfolio ? "Yes" : "No"}</div>
              <div className="row small"><Icon name="check" size="s" /> Review submitted</div>
            </div>
            <p className="muted small p">Releasing confirms your appointment is complete. Your professional&apos;s funds become available right away.</p>
            <ActionForm action={finishStep} submitLabel={`Release ${money(total)}`}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="step" value="4" /></ActionForm>
          </>
        )}
      </div>
    </div>
  );
}
