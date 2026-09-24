import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, categories } from "@/db";
import { requireStudent } from "@/lib/student";
import { Steps } from "@/components/Steps";
import { ActionForm } from "@/components/ActionForm";
import { saveInterests } from "@/app/verify-actions";

export const metadata = { title: "Your interests" };

export default async function Interests() {
  const { profile } = await requireStudent();
  if (profile.verificationStatus === "unverified") redirect("/verify");
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort));
  const mine = new Set(profile.interests ?? []);
  return (
    <div className="scr light">
      <div className="top"><span className="sp" /><div className="t" /><Link className="link small" href="/verify/access">Skip</Link></div>
      <div className="body">
        <Steps at={4} />
        <h1 className="disp h1">What might you use Nearest for?</h1>
        <p className="muted p">Optional. This just personalizes your home screen — you can search everything.</p>
        <ActionForm action={saveInterests} submitLabel="Continue">
          <div className="grid2">
            {cats.map((c) => (
              <label key={c.id} className="chip chipradio" style={{ height: 56, justifyContent: "center", fontSize: 15 }}>
                <input type="checkbox" name="interest" value={c.name} defaultChecked={mine.has(c.name)} />{c.name}
              </label>
            ))}
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
