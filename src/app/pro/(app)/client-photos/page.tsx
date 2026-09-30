import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, bookings, reviews, users, portfolioItems } from "@/db";
import { requirePro } from "@/lib/pro";
import { fmtDate } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";
import { Icon } from "@/components/Icon";
import { ActionForm } from "@/components/ActionForm";
import { showWithReview, hideFromReview, addClientPhotoToPortfolio, removeClientPhoto } from "@/app/pro/client-photo-actions";

export const metadata = { title: "Client photos" };

/**
 * The pro's private gallery of clients' finished-look photos. Nothing here is public until the pro chooses:
 * show it with the client's review, add it to the portfolio (both only if the client allowed sharing), download, or remove.
 */
export default async function ClientPhotos() {
  const { user } = await requirePro();
  const rows = await db
    .select({ b: bookings, first: users.firstName, last: users.lastName, rating: reviews.rating, body: reviews.body, reviewHidden: reviews.hidden })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.studentId))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(and(eq(bookings.proId, user.id), isNotNull(bookings.photoUrl), sql`${bookings.photoStatus} is distinct from 'removed'`))
    .orderBy(desc(bookings.startsAt))
    .limit(100);
  const inPortfolio = new Set(
    (await db.select({ id: portfolioItems.fromBookingId }).from(portfolioItems).where(and(eq(portfolioItems.userId, user.id), isNotNull(portfolioItems.fromBookingId)))).map((r) => r.id),
  );

  return (
    <div className="scr">
      <TopBar title="Client photos" back="/pro/business" />
      <div className="body">
        <h1 className="disp h1">Client photos</h1>
        <p className="small muted p">Photos your clients took of their finished look. They&apos;re private — only you can see them until you choose to show one with its review or add it to your portfolio.</p>
        {rows.length === 0 && <div className="card small"><span className="muted">No client photos yet. When a client finishes an appointment, their photo shows up here.</span></div>}
        {rows.map(({ b, first, last, rating, body, reviewHidden }) => {
          const allowed = Boolean(b.photoForPortfolio);
          const shown = b.photoStatus === "shown";
          const client = [first, last ? `${last[0]}.` : ""].filter(Boolean).join(" ") || "Client";
          return (
            <div key={b.id} className="card" style={{ gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.photoUrl!} alt={`${client}'s ${b.serviceName}`} style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 14 }} />
              <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
                <div className="col" style={{ gap: 2 }}>
                  <span className="b">{client}</span>
                  <span className="xs muted">{b.serviceName} • {fmtDate(b.startsAt, { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {shown && <span className="tag ok">With review</span>}
                  {inPortfolio.has(b.id) && <span className="tag ok">In portfolio</span>}
                  {!shown && !inPortfolio.has(b.id) && <span className="tag">Private</span>}
                </div>
              </div>

              {rating != null ? (
                <div className="col" style={{ gap: 4 }}>
                  <span className="stars" aria-label={`${rating} out of 5`}>{"★".repeat(rating)}<span style={{ opacity: 0.3 }}>{"★".repeat(5 - rating)}</span></span>
                  {body && <p className="small p" style={{ margin: 0 }}>{body}</p>}
                  {reviewHidden && <span className="xs muted">This review is hidden by Nearest, so the photo won&apos;t show with it.</span>}
                </div>
              ) : (
                <span className="xs muted">No review from this client.</span>
              )}

              {allowed
                ? <span className="xs muted"><Icon name="check" size="s" /> {client} allowed you to share this photo.</span>
                : <span className="xs muted"><Icon name="lock" size="s" /> {client} didn&apos;t allow sharing, so this stays private. You can still download it for your records.</span>}

              <div className="col" style={{ gap: 8 }}>
                {allowed && rating != null && (shown
                  ? <ActionForm action={hideFromReview} submitLabel="Hide from review" buttonClass="btn ghost sm" className="col g4"><input type="hidden" name="id" value={b.id} /></ActionForm>
                  : <ActionForm action={showWithReview} submitLabel="Show with their review" buttonClass="btn sm" className="col g4"><input type="hidden" name="id" value={b.id} /></ActionForm>)}
                {allowed && !inPortfolio.has(b.id) && (
                  <ActionForm action={addClientPhotoToPortfolio} submitLabel="Add to my portfolio" buttonClass="btn ghost sm" className="col g4"><input type="hidden" name="id" value={b.id} /></ActionForm>
                )}
                <a className="btn ghost sm" href={`/api/pro/client-photo/${b.id}`} download><Icon name="down" size="s" /> Download to my phone</a>
                <ActionForm action={removeClientPhoto} submitLabel="Remove" buttonClass="link small" className="col g4"><input type="hidden" name="id" value={b.id} /></ActionForm>
              </div>
            </div>
          );
        })}
      </div>
      <Tabs kind="pro" active="Business" />
    </div>
  );
}
