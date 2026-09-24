import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { saveCommunication } from "@/app/pro/actions";

export const metadata = { title: "Communication" };

const LANGS = ["Spoken English", "Spanish"];
const ASL = [["none", "None"], ["basic", "Basic"], ["conversational", "Conversational"], ["fluent", "Fluent"]];

export default async function CommunicationStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, profile: p } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const steps = await setupSteps(user.id);
  const langs = p.languages ?? ["Spoken English"];
  const other = langs.find((l) => !LANGS.includes(l) && l !== "ASL") ?? "";
  return (
    <SetupShell steps={steps} current="communication" title="How can you communicate with clients?" edit={edit}>
      <ActionForm action={saveCommunication} submitLabel={edit ? "Save" : "Save & continue"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        {LANGS.map((l) => <label key={l} className="check"><input type="checkbox" name="languages" value={l} defaultChecked={langs.includes(l)} />{l}</label>)}
        <label className="check"><input type="checkbox" name="text" defaultChecked={p.textCommunication} />Text-based communication (writing back and forth)</label>
        <div className="field"><label htmlFor="otherLanguage">Other language (optional)</label><input id="otherLanguage" name="otherLanguage" defaultValue={other} /></div>
        <fieldset className="col" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="lbl" style={{ marginBottom: 8 }}>ASL communication level</legend>
          <div className="grid2">
            {ASL.map(([v, l]) => <label key={v} className="check"><input type="radio" name="asl" value={v} defaultChecked={p.aslLevel === v} />{l}</label>)}
          </div>
        </fieldset>
        <p className="xs muted p">Customers see your ASL level exactly as you select it. Nearest doesn&apos;t certify fluency.</p>
      </ActionForm>
    </SetupShell>
  );
}
