"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePro } from "@/lib/pro";
import { SIDE_COOKIE } from "@/lib/pro-side";

/** Switch between the Student side and the Partner side (a view setting on this device). */
export async function setProSide(form: FormData) {
  await requirePro();
  const side = form.get("side") === "partner" ? "partner" : "student";
  (await cookies()).set(SIDE_COOKIE, side, { path: "/pro", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: true, httpOnly: true });
  const back = String(form.get("back") ?? "/pro/home");
  redirect(/^\/pro(\/[a-z0-9/-]*)?$/.test(back) ? back : "/pro/home");
}
