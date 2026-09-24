import { asc } from "drizzle-orm";
import { db, categories, catalogServices } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { addCategory, addCatalogService, updateCategory } from "@/app/admin/pro-actions";

export const metadata = { title: "Marketplace" };

export default async function Marketplace() {
  const { role } = await requireAdmin();
  const owner = role === "OWNER";
  const [cats, svc] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sort)),
    db.select().from(catalogServices).orderBy(asc(catalogServices.sort)),
  ]);
  return (
    <>
      <AdminHead eyebrow="Change the catalog without a developer" title="Marketplace" />
      <div className="card" style={{ gap: 12, overflowX: "auto" }}>
        <span className="eyebrow">Categories &amp; suggested services</span>
        <p className="xs muted p">License rules are starting defaults. Confirm each with TDLR. Pros in a license-required category must submit their license before going live.</p>
        <table className="tbl">
          <thead><tr><th>Category</th><th>Suggested services</th><th>License required</th><th>Active</th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id}>
                <td className="b">{c.name}</td>
                <td className="small">{svc.filter((s) => s.categoryId === c.id).map((s) => s.name).join(", ") || "—"}</td>
                <td>
                  <form action={updateCategory} className="row"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="field" value="license" />
                    <button className={`toggle${c.licenseRequired ? " on" : ""}`} type="submit" disabled={!owner} aria-label={`License required for ${c.name}`} aria-pressed={c.licenseRequired} />
                    <span className="xs muted">{c.licenseLabel ?? ""}</span>
                  </form>
                </td>
                <td>
                  <form action={updateCategory}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="field" value="active" />
                    <button className={`toggle${c.active ? " on" : ""}`} type="submit" disabled={!owner} aria-label={`${c.name} active`} aria-pressed={c.active} />
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {owner && (
        <div className="acols even">
          <div className="card">
            <span className="eyebrow">+ Add category</span>
            <ActionForm action={addCategory} submitLabel="Add category" buttonClass="btn sm">
              <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" required /></div>
              <div className="field"><label htmlFor="licenseLabel">License needed (leave blank if none)</label><input id="licenseLabel" name="licenseLabel" placeholder="e.g. Esthetician license (TDLR)" /></div>
            </ActionForm>
          </div>
          <div className="card">
            <span className="eyebrow">+ Add suggested service</span>
            <ActionForm action={addCatalogService} submitLabel="Add service" buttonClass="btn sm">
              <div className="field"><label htmlFor="categoryId">Category</label>
                <select id="categoryId" name="categoryId" required defaultValue=""><option value="" disabled>Choose</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              <div className="field"><label htmlFor="svcname">Service name</label><input id="svcname" name="name" required /></div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
