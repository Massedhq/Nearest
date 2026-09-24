import { redirect } from "next/navigation";

// Admin has no sign-up. Owner logins are created in the Clerk dashboard.
export default function AdminSignUp() {
  redirect("/admin/sign-in");
}
