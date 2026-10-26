import { asc, eq } from "drizzle-orm";
import { db, categories } from "@/db";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";
import { LookFinder } from "@/components/LookFinder";
import { requireBrowsingStudent } from "@/lib/student";

export const metadata = { title: "Find by photo" };

/** Find by photo: upload an inspo photo, see only professionals whose own work closely matches that look. */
export default async function FindLook() {
  const { finishStep } = await requireBrowsingStudent();
  const cats = (await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort)))
    .filter((c) => c.name.trim().toLowerCase() !== "other");
  return (
    <div className="scr">
      <TopBar title="Find by photo" back="/home" />
      <div className="body">
        <h1 className="disp h1">Find your look</h1>
        <p className="small muted p">Upload an inspo photo — a lash set, a nail design, a hairstyle. We compare it with the real work in every professional&apos;s portfolio and only show the ones who have done that look or one very close to it.</p>
        <LookFinder cats={cats} canBook={!finishStep} finishStep={finishStep} />
      </div>
      <Tabs kind="student" active="Explore" />
    </div>
  );
}
