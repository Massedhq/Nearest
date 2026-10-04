import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { SOURCES } from "@/lib/outreach";
import { uploadProspects } from "@/app/admin/outreach-actions";

export const metadata = { title: "Bulk import" };

export default async function BulkImport() {
  await requireAdmin();
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Bulk import" />
      <OutreachNav at="import" />
      <div className="card" style={{ maxWidth: 680, gap: 10 }}>
        <span className="small">Upload a list of professionals — <span className="b">Excel, CSV, Word or PDF</span> — or paste it. Columns can be named anything; Nearest finds names, businesses, cities, categories, emails and phone numbers. <span className="b">Nothing is contacted</span> — you review everything first.</span>
        <ActionForm action={uploadProspects} submitLabel="Read my list">
          <div className="field"><label htmlFor="im-file">File</label><input id="im-file" name="file" type="file" accept=".xlsx,.xls,.csv,.tsv,.docx,.pdf,.txt" /></div>
          <div className="field"><label htmlFor="im-paste">Or paste a list</label><textarea id="im-paste" name="pasted" rows={6} placeholder={"Christina | The Colony | Nails | christina@email.com | 214-555-1234\nMaya Lopez, Plano, Lashes, (469) 555-0101"} /></div>
          <div className="field"><label htmlFor="im-src">Where you found them (for the whole list, optional)</label><select id="im-src" name="source" defaultValue=""><option value="">Mixed / in the file</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
        </ActionForm>
      </div>
    </>
  );
}
