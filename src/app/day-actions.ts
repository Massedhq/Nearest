"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt } from "drizzle-orm";
import { db, bookings, messages } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { requirePro } from "@/lib/pro";
import { getSettings } from "@/lib/settings";
import {
  checkIn, startService, finishService, markNoShow, confirmService, savePhoto, saveReview, finishAndRelease, reportProblem, finishOpen,
} from "@/lib/appointment";
import type { FormState } from "@/components/ActionForm";

type Pos = { lat: number; lng: number; accuracyM: number } | null;
const pos = (f: FormData): Pos => {
  const lat = Number(f.get("lat")), lng = Number(f.get("lng")), acc = Number(f.get("acc"));
  return Number.isFinite(lat) && Number.isFinite(lng) && f.get("lat") ? { lat, lng, accuracyM: Number.isFinite(acc) ? acc : 999 } : null;
};

async function studentBooking(id: string) {
  const { user } = await requireVerifiedStudent();
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.studentId, user.id)) });
  if (!b) redirect("/bookings");
  return { user, b };
}
async function proBooking(id: string) {
  const { user } = await requirePro();
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.proId, user.id)) });
  if (!b) redirect("/pro/appointments");
  return { user, b };
}

// ---------- Student ----------
export async function studentCheckIn(_: FormState, form: FormData): Promise<FormState> {
  const { b } = await studentBooking(String(form.get("id")));
  const p = pos(form);
  if (!p) return { error: "Turn on Location Services for this site, then try again." };
  const res = await checkIn(b, p);
  revalidatePath(`/bookings/${b.id}`);
  return res;
}

export async function studentReport(_: FormState, form: FormData): Promise<FormState> {
  const { user, b } = await studentBooking(String(form.get("id")));
  const res = await reportProblem(b, user.id, String(form.get("reason") ?? ""), String(form.get("details") ?? "").trim().slice(0, 1000) || null, pos(form));
  return res;
}

export async function finishStep(_: FormState, form: FormData): Promise<FormState> {
  const { b } = await studentBooking(String(form.get("id")));
  if (!finishOpen(b)) return { error: "These steps open when your professional finishes the service." };
  const step = String(form.get("step"));
  if (step === "1") {
    await confirmService(b);
    redirect(`/bookings/${b.id}/finish?step=2`);
  }
  if (step === "2") {
    const url = String(form.get("photoUrl") ?? "");
    const okUrl = url && /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\/students\//.test(url) ? url : null;
    await savePhoto(b, okUrl, form.get("allow") === "yes");
    redirect(`/bookings/${b.id}/finish?step=3`);
  }
  if (step === "3") {
    const rating = Number(form.get("rating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose 1 to 5 stars." };
    await saveReview(b, rating, String(form.get("body") ?? "").trim().slice(0, 1000) || null);
    redirect(`/bookings/${b.id}/finish?step=4`);
  }
  if (step === "4") {
    try {
      const res = await finishAndRelease(b);
      if (res.error) return { error: res.error };
    } catch (e) {
      console.error(e);
      return { error: "Something went wrong releasing payment. It's still protected — try again in a minute." };
    }
    redirect(`/bookings/${b.id}/finish?step=done`);
  }
  return { error: "Something went wrong." };
}

// ---------- Pro ----------
export async function proStart(form: FormData) {
  const { b } = await proBooking(String(form.get("id")));
  await startService(b);
  revalidatePath(`/pro/appointments/${b.id}`);
}
export async function proFinish(form: FormData) {
  const { b } = await proBooking(String(form.get("id")));
  await finishService(b);
  revalidatePath(`/pro/appointments/${b.id}`);
}
export async function proNoShow(_: FormState, form: FormData): Promise<FormState> {
  const { b } = await proBooking(String(form.get("id")));
  const res = await markNoShow(b);
  revalidatePath("/pro", "layout");
  return res;
}

// ---------- Messages (either side) ----------
export async function sendMessage(_: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get("id"));
  const as = String(form.get("as"));
  const { user, b } = as === "pro" ? await proBooking(id) : await studentBooking(id);
  const body = String(form.get("body") ?? "").trim().slice(0, 1000);
  if (!body) return {};
  const s = await getSettings();
  const closes = new Date(b.endsAt.getTime() + Number(s["appt.messaging_days"]) * 86400000);
  if (!["confirmed", "completed", "no_show"].includes(b.status) || Date.now() > closes.getTime()) return { error: "This conversation is closed." };
  await db.insert(messages).values({ bookingId: b.id, senderId: user.id, body });
  return { ok: "sent" };
}

export async function latestMessageAt(bookingId: string) {
  const row = await db.query.messages.findFirst({ where: and(eq(messages.bookingId, bookingId), gt(messages.createdAt, new Date(0))), orderBy: (m, { desc }) => [desc(m.createdAt)] });
  return row?.createdAt ?? null;
}
