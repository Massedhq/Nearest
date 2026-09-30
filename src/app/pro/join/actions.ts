"use server";
import { redirect } from "next/navigation";
import { requirePro } from "@/lib/pro";
import { origin } from "@/lib/stripe";
import { startEntryCheckout, isEntryType, isManagedEntry } from "@/lib/entry";
import type { FormState } from "@/components/ActionForm";

export async function payEntry(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro({ allowUnpaid: true });
  const type = String(form.get("type"));
  // Free and pay-from-bookings accounts come only from the main owner's invitations — never from this page.
  if (!isEntryType(type) || isManagedEntry(type)) return { error: "Choose an option." };
  let student;
  if (type === "PRO_STUDENT") {
    const firstName = String(form.get("studentFirst") ?? "").trim().slice(0, 60);
    const lastName = String(form.get("studentLast") ?? "").trim().slice(0, 60);
    const email = String(form.get("studentEmail") ?? "").trim().slice(0, 120);
    const school = String(form.get("studentSchool") ?? "").trim().slice(0, 120) || null;
    if (!firstName || !lastName) return { error: "Enter your student's first and last name." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter your student's email." };
    if (email.toLowerCase() === (user.email ?? "").toLowerCase()) return { error: "The student needs their own email address." };
    student = { firstName, lastName, email, school };
  }
  const res = await startEntryCheckout(user, { type, student }, await origin());
  if ("error" in res) return { error: res.error };
  redirect(res.url);
}
