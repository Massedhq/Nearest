"use server";
import { redirect } from "next/navigation";
import { db, professionalProfiles } from "@/db";
import { getViewer } from "@/lib/viewer";
import { logActivity } from "@/lib/log";

/**
 * An owner sets up their own professional business on their owner login.
 * Nothing about the owner account changes (name, email, owner access) — only a professional profile is added.
 */
export async function createOwnerBusiness() {
  const viewer = await getViewer();
  if (!viewer?.user || !viewer.admin) redirect("/");
  await db.insert(professionalProfiles).values({ userId: viewer.user.id, cohort: "FOUNDING" }).onConflictDoNothing();
  await logActivity({ actorUserId: viewer.user.id, action: "owner.pro_business_created", targetType: "owner", targetId: viewer.user.email ?? viewer.user.id });
  redirect("/pro/setup/profile");
}
