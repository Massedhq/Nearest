import "server-only";
import Link from "next/link";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { db, users, professionalProfiles } from "@/db";
import { partners } from "@/lib/partner";
import { CopyLink } from "@/app/admin/(console)/founding/CopyLink";

/**
 * One link for professionals and one for students — share them anywhere (texts, DMs, bios, flyers) instead of typing a
 * name and email for each person. Both carry the owner's personal code (?ref=CODE), remembered for 30 days, so whoever
 * signs up through them is credited to that owner. Professionals join under the normal city + category spot rules
 * (First In while spots are open, waiting list when full) — only personal invitations skip those rules.
 */
export async function ShareLinks({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const me = (await partners()).find((p) => p.userId === userId);
  const code = me?.code ?? null;
  const q = code ? `?ref=${code}` : "";
  const proLink = `${origin}/pro/sign-up${q}`;
  const studentLink = `${origin}/sign-up${q}`;
  const [[pros], [students]] = code
    ? await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles).where(eq(professionalProfiles.referredBy, userId)),
      db.select({ n: sql<number>`count(*)::int` }).from(users).where(and(eq(users.referredByPartner, userId), eq(users.accountType, "student"))),
    ])
    : [[{ n: 0 }], [{ n: 0 }]];

  return (
    <div className="card" style={{ gap: 12 }}>
      <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="eyebrow">Your share links</span>
        {code && <span className="xs muted">Your code: <span className="b">{code}</span></span>}
      </div>
      {!compact && <span className="small muted">No name or email needed. Copy a link and send it anywhere — a text, a DM, your bio, a flyer. Everyone who signs up through it is credited to you.</span>}
      <div className="col" style={{ gap: 6 }}>
        <span className="small b">Professionals{code ? ` — ${pros.n} joined through your link` : ""}</span>
        <CopyLink url={proLink} />
      </div>
      <div className="col" style={{ gap: 6 }}>
        <span className="small b">Students{code ? ` — ${students.n} signed up through your link` : ""}</span>
        <CopyLink url={studentLink} />
      </div>
      {!compact && <span className="xs muted">Professionals from your link get a First In spot while their city and service still have open spots; when a spot is full they join the waiting list. To let one specific professional in past a full spot, send a personal invitation below instead.</span>}
      {compact && <Link className="link small" href="/admin/founding">More on First In</Link>}
      {!code && <span className="xs muted">These links work, but they don&apos;t credit anyone because your account has no personal code. Owners get one automatically.</span>}
    </div>
  );
}
