import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The launch reward is Nearest credit now (added automatically on approval), so there's nothing to book here. */
export default function RewardPage() {
  redirect("/campaign");
}
