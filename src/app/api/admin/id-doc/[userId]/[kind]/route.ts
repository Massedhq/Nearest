import { and, eq } from "drizzle-orm";
import { db, studentIdDocs, users } from "@/db";
import { getViewer } from "@/lib/viewer";
import { logActivity } from "@/lib/log";

// Serves a student's ID photo or selfie to admins only. Every view is written to the activity log.
export async function GET(_: Request, { params }: { params: Promise<{ userId: string; kind: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.admin || !viewer.user) return new Response("Not allowed", { status: 403 });
  const { userId, kind } = await params;
  if (!["school_id", "selfie"].includes(kind) || !/^[0-9a-f-]{36}$/.test(userId)) return new Response("Not found", { status: 404 });
  const doc = await db.query.studentIdDocs.findFirst({ where: and(eq(studentIdDocs.userId, userId), eq(studentIdDocs.kind, kind)) });
  if (!doc) return new Response("Already deleted", { status: 404 });
  const student = await db.query.users.findFirst({ where: eq(users.id, userId) });
  await logActivity({ actorUserId: viewer.user.id, action: "student.id_viewed", targetType: "student", targetId: student ? `${student.firstName} ${student.lastName}` : userId, after: kind });
  return new Response(Buffer.from(doc.dataB64, "base64"), {
    headers: { "Content-Type": doc.mime, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" },
  });
}
