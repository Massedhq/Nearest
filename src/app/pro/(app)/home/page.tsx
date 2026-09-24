import Image from "next/image";
import Link from "next/link";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db, modelCalls, proOpenings, bookings } from "@/db";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { requirePro, setupSteps, setupComplete } from "@/lib/pro";
import { chicagoNow, fmtDate, fmtTime, label12, money } from "@/lib/time";
import { proStanding } from "@/lib/enforcement";

export const metadata = { title: "Today" };

function greeting(minutes: number) {
  return minutes < 720 ? "Good morning" : minutes < 1020 ? "Good afternoon" : "Good evening";
}

export default async function ProHome() {
  const { viewer, user, profile } = await requirePro();
  const now = chicagoNow();
  const [steps, calls, openings, upcoming] = await Promise.all([
    setupSteps(user.id),
    db.select().from(modelCalls).where(and(eq(modelCalls.userId, user.id), inArray(modelCalls.status, ["open", "full"]), gte(modelCalls.startsAt, new Date()))).orderBy(asc(modelCalls.startsAt)).limit(3),
    db.select().from(proOpenings).where(and(eq(proOpenings.userId, user.id), eq(proOpenings.day, now.date))).orderBy(asc(proOpenings.startTime)),
    db.select().from(bookings).where(and(eq(bookings.proId, user.id), eq(bookings.status, "confirmed"), gte(bookings.endsAt, new Date()))).orderBy(asc(bookings.startsAt)).limit(4),
  ]);
  const payReady = ["trialing", "active"].includes(profile.subscriptionStatus ?? "") && profile.identityStatus === "verified" && profile.payoutsEnabled;
  const approved = profile.reviewStatus === "approved";
  const standing = await proStanding(user.id);
  const left = steps.filter((s) => !s.done && !s.optional);
  const next = left[0];

  return (
    <div className="scr">
      <div className="top" style={{ justifyContent: "space-between" }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={48} height={48} />
        {viewer.admin ? <Link className="chip" href="/workspace"><Icon name="switch" size="s" /> Switch workspace</Link> : <span />}
        <span className="iconbtn" aria-label="Notifications"><Icon name="bell" /></span>
      </div>
      <div className="body">
        <div><p className="eyebrow p">{fmtDate(new Date(), { weekday: "long", month: "short", day: "numeric" })}</p><h1 className="disp h1">{greeting(now.minutes)}, {user.firstName}</h1></div>

        {(standing.fines.length > 0 || standing.suspendedUntil) && (
          <Link className={`card ${standing.overdue.length || standing.suspendedUntil ? "bad" : "warn"}`} href="/pro/account-status" style={{ textDecoration: "none" }}>
            <div className="row"><Icon name="alert" /><div className="grow">
              <div className="b">{standing.suspendedUntil ? `Suspended until ${fmtDate(standing.suspendedUntil)}` : `${money(standing.fines[0].amountCents)} fine outstanding`}</div>
              <div className="xs muted">{standing.suspendedUntil ? "Hidden from students" : `Due ${fmtDate(standing.fines[0].dueAt)}`}</div>
            </div><Icon name="right" size="s" /></div>
          </Link>
        )}

        {!approved && (
          <div className="card" style={{ gap: 12 }}>
            <div className="row between"><span className="eyebrow">Set up your business</span><span className="xs muted">{steps.filter((s) => s.done).length} of {steps.length}</span></div>
            <div className="bar"><i style={{ width: `${Math.round((steps.filter((s) => s.done).length / steps.length) * 100)}%` }} /></div>
            {profile.reviewStatus === "submitted" ? (
              <span className="small">Submitted — Nearest is reviewing your profile.</span>
            ) : profile.reviewStatus === "rejected" ? (
              <><span className="small err">Changes needed: {profile.reviewNote}</span><Link className="btn sm" href="/pro/setup/review" style={{ width: "100%" }}>Review &amp; resubmit</Link></>
            ) : setupComplete(steps) ? (
              <Link className="btn sm" href="/pro/setup/review" style={{ width: "100%" }}>Preview &amp; submit</Link>
            ) : (
              <Link className="btn sm" href={next?.href ?? "/pro/setup/profile"} style={{ width: "100%" }}>Continue: {next?.label}</Link>
            )}
          </div>
        )}

        {profile.cohort === "FOUNDING" && (
          <div className="card pearl"><span className="tag solid" style={{ background: "#0A0A0A", color: "#ECE8E1", alignSelf: "flex-start" }}>Founding Professional</span><span className="small">Your founding rate is locked to your account.</span></div>
        )}

        {approved && !payReady && (
          <Link className="card warn" href="/pro/payments" style={{ textDecoration: "none" }}>
            <div className="row"><Icon name="card" /><div className="grow"><div className="b">Finish membership, ID and payouts</div><div className="xs muted">Students can book you once these are done.</div></div><Icon name="right" size="s" /></div>
          </Link>
        )}

        {upcoming.filter((b) => b.checkedInAt && !b.startedAt).map((b) => (
          <Link key={`ci-${b.id}`} className="card ok" href={`/pro/appointments/${b.id}`} style={{ textDecoration: "none" }}>
            <div className="row"><Icon name="check" /><div className="grow"><div className="b">Your {fmtTime(b.startsAt)} client has checked in</div><div className="xs muted">Tap to start service</div></div><Icon name="right" size="s" /></div>
          </Link>
        ))}

        <div className="row between"><h3 className="eyebrow p">Upcoming appointments</h3><Link className="link small" href="/pro/appointments">See all</Link></div>
        {upcoming.length === 0 && <p className="small muted p">No upcoming appointments.</p>}
        {upcoming.map((b) => (
          <Link key={b.id} className="item" href={`/pro/appointments/${b.id}`}>
            <span className="b num" style={{ width: 84 }}>{fmtTime(b.startsAt)}</span>
            <div className="grow"><div>{b.serviceName}</div><div className="xs muted">{fmtDate(b.startsAt)}</div></div>
            <span className="tag ok">Confirmed</span>
          </Link>
        ))}

        <Link className="card" href="/pro/today" style={{ textDecoration: "none" }}>
          <div className="row">
            <Icon name="bolt" />
            <div className="grow">
              <div className="b">Available Today</div>
              <div className="xs muted">{openings.length ? openings.map((o) => label12(o.startTime)).join(" • ") : approved ? "Post openings before 12:00 PM" : "Unlocks after approval"}</div>
            </div>
            <Icon name="right" size="s" />
          </div>
        </Link>

        <div className="row between"><h3 className="eyebrow p">Your model calls</h3><Link className="link small" href="/pro/model-calls">See all</Link></div>
        {calls.length === 0 && <p className="small muted p">No upcoming model calls.</p>}
        {calls.map((c) => (
          <div key={c.id} className="item">
            <div className="grow"><div className="b">{c.serviceName}</div><div className="xs muted">{fmtDate(c.startsAt)} • {fmtTime(c.startsAt)} • {money(c.priceCents)}</div></div>
            <span className="tag">{c.spots - c.spotsTaken} spot{c.spots - c.spotsTaken === 1 ? "" : "s"} left</span>
          </div>
        ))}
        {approved ? (
          <Link className="btn" href="/pro/model-calls/new"><Icon name="plus" /> Create a model call</Link>
        ) : (
          <button className="btn dis" type="button" disabled><Icon name="plus" /> Create a model call — after approval</button>
        )}

        <div className="grid3" style={{ gap: 10 }}>
          <Link className="card" href="/pro/calendar" style={{ textDecoration: "none", padding: 12, alignItems: "center", gap: 6 }}><Icon name="lock" /><span className="xs">Block time</span></Link>
          <Link className="card" href="/pro/setup/services?edit=1" style={{ textDecoration: "none", padding: 12, alignItems: "center", gap: 6 }}><Icon name="grid" /><span className="xs">Services</span></Link>
          <Link className="card" href="/pro/setup/portfolio?edit=1" style={{ textDecoration: "none", padding: 12, alignItems: "center", gap: 6 }}><Icon name="camera" /><span className="xs">Add work</span></Link>
        </div>
      </div>
      <Tabs kind="pro" active="Today" />
    </div>
  );
}
