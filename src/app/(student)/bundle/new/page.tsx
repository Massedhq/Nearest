import { and, asc, eq, ne } from "drizzle-orm";
import { db, categories } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { chicagoNow } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { createBundle } from "@/app/bundle-actions";

export const metadata = { title: "Start a bundle" };

export default async function NewBundle() {
  await requireVerifiedStudent();
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.active, true), ne(categories.name, "Other"))).orderBy(asc(categories.sort), asc(categories.name));
  const today = new Date(`${chicagoNow().date}T12:00:00Z`).getTime();
  const min = new Date(today + 86400000).toISOString().slice(0, 10);
  const max = new Date(today + 60 * 86400000).toISOString().slice(0, 10);
  return (
    <div className="scr">
      <TopBar title="Bundle my booking" back="/bundle" />
      <div className="body">
        <h1 className="disp h1">What do you need?</h1>
        <ActionForm action={createBundle} submitLabel="Search my area">
          <div className="field">
            <span className="small b">1. Pick everything you need booked</span>
            <div className="chips">
              {cats.map((c) => (
                <label key={c.id} className="chip" style={{ cursor: "pointer" }}>
                  <input type="checkbox" name="cat" value={c.id} style={{ accentColor: "#E3C58A" }} /> {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="bd-budget" className="small b">2. Your total budget</label>
            <input id="bd-budget" name="budget" inputMode="decimal" placeholder="$250" required />
          </div>
          <div className="field">
            <label htmlFor="bd-start" className="small b">3. The week you need it done — starting</label>
            <input id="bd-start" name="start" type="date" min={min} max={max} required />
            <span className="xs muted">We&apos;ll look for openings over the 7 days starting that day.</span>
          </div>
          <span className="xs muted">Credits and invite rewards can&apos;t be used on bundle bookings — only on single bookings.</span>
        </ActionForm>
      </div>
    </div>
  );
}
