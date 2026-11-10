import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { requirePro } from "@/lib/pro";
import { liveProWhere } from "@/lib/search";
import { ensureProSlug } from "@/lib/connections";
import { partnerSides } from "@/lib/partner-booking";
import { publicPartnerPage, partnerPagePath } from "@/lib/partners";

/**
 * Shown on every Business edit screen (?edit=1). Uploads save the moment they finish and typed changes save with the
 * Save button — then the pro jumps straight to what clients see (student side and/or partner side) or back to Business,
 * instead of stepping back through setup.
 */
export async function EditDoneBar() {
  const { user } = await requirePro();
  const [slug, sides] = await Promise.all([ensureProSlug(user.id), partnerSides(user.id)]);
  const live = slug ? Boolean((await db.select({ id: professionalProfiles.userId }).from(professionalProfiles)
    .where(and(eq(professionalProfiles.userId, user.id), ...liveProWhere(null, "all"))).limit(1))[0]) : false;
  const partnerLive = sides.partner && slug ? Boolean(await publicPartnerPage(slug)) : false;
  const studentHref = live && slug ? `/pro-${slug}` : "/pro/setup/review";
  const partnerHref = partnerLive && slug ? partnerPagePath(slug) : "/pro/partner-preview";
  return (
    <div className="card" style={{ gap: 8, padding: 12 }}>
      <span className="xs muted">Photos and videos save as soon as they finish uploading. Typed changes save when you tap Save. When you&apos;re done:</span>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {!sides.partnerOnly && <Link className="btn sm" href={studentHref}>{live ? "See my profile (student side)" : "Preview my profile (student side)"}</Link>}
        {sides.partner && <Link className="btn sm" href={partnerHref}>{partnerLive ? "See my partner page" : "Preview my partner page"}</Link>}
        <Link className="btn ghost sm" href="/pro/business">Back to Business</Link>
      </div>
    </div>
  );
}
