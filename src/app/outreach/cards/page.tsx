import { redirect } from "next/navigation";

/** Cards now live with each organization (2026-11-25, owner: one screen) — Organizations & cards. */
export default function Page() {
  redirect("/outreach/orgs");
}
