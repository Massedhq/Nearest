import { asc, eq, and } from "drizzle-orm";
import { db, adminMembers, users, categories } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { outreachScope, SOURCES } from "@/lib/outreach";
import { addProspect } from "@/app/admin/outreach-actions";

export const metadata = { title: "Add prospect" };

export default async function AddProspect() {
  const { user } = await requireAdmin();
  const { isMain } = await outreachScope(user.id);
  const cats = await db.select({ name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort));
  const partners = isMain ? await db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(adminMembers).innerJoin(users, eq(users.id, adminMembers.userId)).where(and(eq(adminMembers.role, "OWNER"), eq(adminMembers.active, true))) : [];
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Add prospect" />
      <OutreachNav at="add" />
      <div className="card" style={{ maxWidth: 640 }}>
        <ActionForm action={addProspect} submitLabel="Add prospect">
          <div className="grid2">
            <div className="field"><label htmlFor="ap-name">Professional name</label><input id="ap-name" name="name" required maxLength={120} /></div>
            <div className="field"><label htmlFor="ap-bus">Business name (optional)</label><input id="ap-bus" name="business" maxLength={120} /></div>
            <div className="field"><label htmlFor="ap-city">City</label><input id="ap-city" name="city" maxLength={80} placeholder="The Colony" /></div>
            <div className="field"><label htmlFor="ap-state">State</label><input id="ap-state" name="state" maxLength={20} defaultValue="TX" /></div>
            <div className="field"><label htmlFor="ap-cat">Category</label><input id="ap-cat" name="category" list="ap-cats" maxLength={80} placeholder="Nails" /><datalist id="ap-cats">{cats.map((c) => <option key={c.name} value={c.name} />)}</datalist></div>
            <div className="field"><label htmlFor="ap-src">Source</label><select id="ap-src" name="source" defaultValue=""><option value="">Choose</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field"><label htmlFor="ap-email">Email</label><input id="ap-email" name="email" type="email" maxLength={120} /></div>
            <div className="field"><label htmlFor="ap-phone">Phone</label><input id="ap-phone" name="phone" maxLength={30} /></div>
          </div>
          {isMain && partners.length > 0 && (
            <div className="field"><label htmlFor="ap-rec">Partner</label><select id="ap-rec" name="recruiter" defaultValue={user.id}>{partners.map((p) => <option key={p.id} value={p.id}>{[p.first, p.last].filter(Boolean).join(" ")}</option>)}</select></div>
          )}
          <div className="field"><label htmlFor="ap-notes">Notes</label><textarea id="ap-notes" name="notes" rows={3} maxLength={1000} placeholder="e.g. Student pricing, within Nearest limits" /></div>
          <label className="check xs"><input type="checkbox" name="addAnyway" /><span>Add anyway if there&apos;s a possible duplicate (same name in the same city)</span></label>
          <span className="xs muted">Email or phone is required. Nearest checks every partner&apos;s prospects, existing accounts and the do-not-contact list first.</span>
        </ActionForm>
      </div>
    </>
  );
}
