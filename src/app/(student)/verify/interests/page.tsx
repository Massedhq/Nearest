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
  if (profile.verificationStatus === "unverified" && !profile.selfieOnlyAt) redirect("/verify");
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort));
  const mine = new Set(profile.interests ?? []);
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t" /><span className="sp" /></div>
      <div className="body">
        <Steps at={4} />
        <h1 className="disp h1">What are you most interested in?</h1>
        <p className="muted p">Pick everything you&apos;d book. It tells us which professionals to bring to your city first, and we&apos;ll let you know as soon as they&apos;re here and ready for you. You can still search everything.</p>
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
