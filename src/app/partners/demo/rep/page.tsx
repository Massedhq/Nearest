import { redirect } from "next/navigation";

/** Old address of the rep dashboard demo — it now lives on its own at /reps/demo (sales reps are separate from partners). */
export default function OldRepDemo() {
  redirect("/reps/demo");
}
