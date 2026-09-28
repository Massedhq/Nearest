import "server-only";
import { and, eq, ne, or, sql, inArray, desc, gte } from "drizzle-orm";
import { db, users, studentProfiles, schools, connections, proShares, professionalProfiles } from "@/db";
import { inbox } from "./inbox";

// ---------- Names ----------
export const shortName = (u: { firstName: string | null; lastName: string | null }) =>
  `${u.firstName ?? "Student"}${u.lastName ? ` ${u.lastName[0]}.` : ""}`;

const ageOf = (dob: string | null) => {
  if (!dob) return 99;
  const d = new Date(`${dob}T12:00:00Z`), n = new Date();
  let a = n.getUTCFullYear() - d.getUTCFullYear();
  if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--;
  return a;
};

// ---------- Usernames (students) ----------
/** Every student gets a simple username (e.g. mayaj27) they can share so friends can find them. */
export async function ensureUsername(u: { id: string; username: string | null; firstName: string | null; lastName: string | null }) {
  if (u.username) return u.username;
  const base = `${u.firstName ?? "student"}${(u.lastName ?? "")[0] ?? ""}`.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "student";
  for (let i = 0; i < 8; i++) {
    const name = `${base}${Math.floor(10 + Math.random() * 90)}${i > 3 ? Math.floor(Math.random() * 10) : ""}`;
    const [row] = await db.update(users).set({ username: name }).where(and(eq(users.id, u.id), sql`${users.username} is null`)).returning().catch(() => []);
    if (row) return name;
    const now = await db.query.users.findFirst({ where: eq(users.id, u.id) });
    if (now?.username) return now.username;
  }
  return null;
}

// ---------- Connections ----------
type Pair = typeof connections.$inferSelect;
async function pairOf(a: string, b: string): Promise<Pair | undefined> {
  return (await db.select().from(connections).where(or(and(eq(connections.requesterId, a), eq(connections.addresseeId, b)), and(eq(connections.requesterId, b), eq(connections.addresseeId, a)))).limit(1))[0];
}

/**
 * Search verified students to connect with.
 * - Exact username (with or without @) finds anyone verified.
 * - Name search: adults are findable by anyone; students under 18 are findable by name only by students at their school.
 * Only first name, last initial and school are shown.
 */
export async function searchStudents(meId: string, q: string) {
  const term = q.trim().replace(/^@/, "").toLowerCase();
  if (term.length < 2) return [];
  const me = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, meId) });
  const rows = await db.select({ id: users.id, first: users.firstName, last: users.lastName, username: users.username, dob: users.dateOfBirth, schoolId: studentProfiles.schoolId, school: schools.name })
    .from(users).innerJoin(studentProfiles, eq(studentProfiles.userId, users.id)).leftJoin(schools, eq(schools.id, studentProfiles.schoolId))
    .where(and(ne(users.id, meId), eq(users.accountType, "student"), eq(studentProfiles.verificationStatus, "verified"), sql`${users.status} is distinct from 'deactivated'`,
      or(eq(sql`lower(${users.username})`, term), sql`lower(coalesce(${users.firstName},'') || ' ' || coalesce(${users.lastName},'')) like ${"%" + term + "%"}`)))
    .limit(40);
  const out = rows.filter((r) => (r.username ?? "").toLowerCase() === term || ageOf(r.dob) >= 18 || (me?.schoolId != null && r.schoolId === me.schoolId)).slice(0, 10);
  const ids = out.map((r) => r.id);
  const pairs = ids.length ? await db.select().from(connections).where(or(and(eq(connections.requesterId, meId), inArray(connections.addresseeId, ids)), and(eq(connections.addresseeId, meId), inArray(connections.requesterId, ids)))) : [];
  return out.map((r) => {
    const p = pairs.find((x) => x.requesterId === r.id || x.addresseeId === r.id);
    const state = !p ? "none" : p.status === "accepted" ? "connected" : p.requesterId === meId ? "requested" : "incoming";
    return { id: r.id, name: shortName({ firstName: r.first, lastName: r.last }), school: r.school, state };
  });
}

export async function requestConnection(meId: string, toId: string): Promise<{ ok?: string; error?: string }> {
  if (meId === toId) return { error: "That's you." };
  const target = await db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(and(eq(users.id, toId), eq(users.accountType, "student"), eq(studentProfiles.verificationStatus, "verified"))).limit(1);
  if (!target[0]) return { error: "That student isn't available." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(connections).where(and(eq(connections.requesterId, meId), gte(connections.createdAt, new Date(Date.now() - 86400_000))));
  if (n >= 30) return { error: "You've sent a lot of requests today. Try again tomorrow." };
  const existing = await pairOf(meId, toId);
  const me = (await db.query.users.findFirst({ where: eq(users.id, meId) }))!;
  if (existing?.status === "accepted") return { ok: "You're already connected." };
  if (existing && existing.requesterId === toId) return respondConnection(meId, existing.id, true); // they asked first → accept
  if (existing) return { ok: "Request already sent." };
  await db.insert(connections).values({ requesterId: meId, addresseeId: toId }).onConflictDoNothing();
  await inbox(toId, { kind: "connection", title: `${shortName(me)} wants to connect`, body: "Accept to share professionals with each other.", href: "/connections" });
  return { ok: `Request sent to ${shortName({ firstName: target[0].first, lastName: target[0].last })}.` };
}

export async function respondConnection(meId: string, id: string, accept: boolean): Promise<{ ok?: string; error?: string }> {
  const c = (await db.select().from(connections).where(and(eq(connections.id, id), eq(connections.addresseeId, meId), eq(connections.status, "pending"))).limit(1))[0];
  if (!c) return { error: "That request is no longer available." };
  if (!accept) { await db.delete(connections).where(eq(connections.id, id)); return { ok: "Request declined." }; }
  await db.update(connections).set({ status: "accepted", respondedAt: new Date() }).where(eq(connections.id, id));
  const me = (await db.query.users.findFirst({ where: eq(users.id, meId) }))!;
  await inbox(c.requesterId, { kind: "connection", title: `${shortName(me)} accepted your connection`, body: "You can now share professionals with each other.", href: "/connections" });
  return { ok: "Connected." };
}

export async function removeConnection(meId: string, otherId: string) {
  await db.delete(connections).where(or(and(eq(connections.requesterId, meId), eq(connections.addresseeId, otherId)), and(eq(connections.requesterId, otherId), eq(connections.addresseeId, meId))));
}

/** My Connections (accepted), Pending Connections (incoming + sent). */
export async function myConnections(meId: string) {
  const rows = await db.select().from(connections).where(or(eq(connections.requesterId, meId), eq(connections.addresseeId, meId)));
  const otherIds = [...new Set(rows.map((r) => (r.requesterId === meId ? r.addresseeId : r.requesterId)))];
  const people = otherIds.length ? await db.select({ id: users.id, first: users.firstName, last: users.lastName, school: schools.name })
    .from(users).leftJoin(studentProfiles, eq(studentProfiles.userId, users.id)).leftJoin(schools, eq(schools.id, studentProfiles.schoolId)).where(inArray(users.id, otherIds)) : [];
  const who = (id: string) => { const p = people.find((x) => x.id === id); return { id, name: p ? shortName({ firstName: p.first, lastName: p.last }) : "Student", school: p?.school ?? null }; };
  return {
    connected: rows.filter((r) => r.status === "accepted").map((r) => who(r.requesterId === meId ? r.addresseeId : r.requesterId)).sort((a, b) => a.name.localeCompare(b.name)),
    incoming: rows.filter((r) => r.status === "pending" && r.addresseeId === meId).map((r) => ({ requestId: r.id, ...who(r.requesterId) })),
    sent: rows.filter((r) => r.status === "pending" && r.requesterId === meId).map((r) => who(r.addresseeId)),
  };
}

/** Share a professional with one or more accepted connections. */
export async function sharePro(meId: string, proId: string, toIds: string[]): Promise<{ ok?: string; error?: string }> {
  const ids = [...new Set(toIds)].slice(0, 25);
  if (!ids.length) return { error: "Choose at least one connection." };
  const { connected } = await myConnections(meId);
  const allowed = ids.filter((id) => connected.some((c) => c.id === id));
  if (!allowed.length) return { error: "You can only share with your connections." };
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, proId) });
  if (!pro) return { error: "That professional isn't available." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(proShares).where(and(eq(proShares.fromId, meId), gte(proShares.createdAt, new Date(Date.now() - 86400_000))));
  if (n + allowed.length > 100) return { error: "You've shared a lot today. Try again tomorrow." };
  await db.insert(proShares).values(allowed.map((toId) => ({ fromId: meId, toId, proId })));
  const me = (await db.query.users.findFirst({ where: eq(users.id, meId) }))!;
  for (const toId of allowed) {
    await inbox(toId, { kind: "share", title: `${shortName(me)} shared ${pro.businessName ?? "a professional"} with you`, body: "Tap to see their work and prices.", href: `/p/${proId}` });
  }
  return { ok: `Sent to ${allowed.length} connection${allowed.length === 1 ? "" : "s"}.` };
}

/** Professionals my connections sent me (newest first). */
export async function sharedWithMe(meId: string) {
  return db.select({ id: proShares.id, proId: proShares.proId, at: proShares.createdAt, business: professionalProfiles.businessName, photo: professionalProfiles.photoUrl, first: users.firstName, last: users.lastName })
    .from(proShares).innerJoin(professionalProfiles, eq(professionalProfiles.userId, proShares.proId)).innerJoin(users, eq(users.id, proShares.fromId))
    .where(eq(proShares.toId, meId)).orderBy(desc(proShares.createdAt)).limit(30);
}

// ---------- Pro links: usenearest.com/pro-<slug> ----------
const RESERVED = new Set(["admin", "api", "sign-in", "sign-up", "home", "setup", "join", "invite", "payments", "nearest", "support", "help"]);
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
export const validSlug = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(s) && !RESERVED.has(s);

/** Every pro gets a link name from their business name (kisses-lashes); stays the same unless they change it. */
export async function ensureProSlug(userId: string) {
  const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) });
  if (!p) return null;
  if (p.slug) return p.slug;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  let base = slugify(p.businessName ?? u?.firstName ?? "pro");
  if (!validSlug(base)) base = `${base || "pro"}-studio`.slice(0, 30);
  for (let i = 0; i < 10; i++) {
    const cand = i === 0 ? base : `${base.slice(0, 26)}-${Math.floor(10 + Math.random() * 990)}`;
    const [row] = await db.update(professionalProfiles).set({ slug: cand }).where(and(eq(professionalProfiles.userId, userId), sql`${professionalProfiles.slug} is null`)).returning().catch(() => []);
    if (row) return cand;
  }
  return null;
}

export const proLink = (slug: string) => `${process.env.APP_URL || "https://usenearest.com"}/pro-${slug}`;
