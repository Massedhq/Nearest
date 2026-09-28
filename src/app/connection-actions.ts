"use server";
import { revalidatePath } from "next/cache";
import { requireVerifiedStudent } from "@/lib/student";
import { searchStudents, requestConnection, respondConnection, removeConnection, myConnections, sharePro } from "@/lib/connections";

export async function findStudents(q: string) {
  const { user } = await requireVerifiedStudent();
  return searchStudents(user.id, String(q ?? "").slice(0, 60));
}

export async function connectWith(toId: string) {
  const { user } = await requireVerifiedStudent();
  const r = await requestConnection(user.id, String(toId));
  revalidatePath("/connections");
  return r;
}

export async function answerRequest(form: FormData) {
  const { user } = await requireVerifiedStudent();
  await respondConnection(user.id, String(form.get("id")), form.get("accept") === "1");
  revalidatePath("/connections");
}

export async function removeConnectionAction(form: FormData) {
  const { user } = await requireVerifiedStudent();
  await removeConnection(user.id, String(form.get("otherId")));
  revalidatePath("/connections");
}

/** For the Share with a Connection sheet: only accepted connections, never the whole student list. */
export async function connectionsForShare() {
  const { user } = await requireVerifiedStudent();
  return (await myConnections(user.id)).connected;
}

export async function shareProWith(proId: string, toIds: string[]) {
  const { user } = await requireVerifiedStudent();
  return sharePro(user.id, String(proId), (toIds ?? []).map(String));
}
