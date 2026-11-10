import { asc, eq } from "drizzle-orm";
import { db, categories, catalogServices, proServices } from "@/db";
import { requirePro, setupSteps } from "@/lib/pro";
import { EditDoneBar } from "@/components/EditDoneBar";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { ServicesEditor } from "@/components/ServicesEditor";
import { getSettings } from "@/lib/settings";
import { saveServices } from "@/app/pro/actions";

export const metadata = { title: "Services" };

export default async function ServicesStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, profile } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const [steps, cats, sugg, mine] = await Promise.all([
    setupSteps(user.id),
    db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort)),
    db.select().from(catalogServices).orderBy(asc(catalogServices.sort)),
    db.select().from(proServices).where(eq(proServices.userId, user.id)).orderBy(asc(proServices.sort)),
  ]);
  const catProps = cats.map((c) => ({ id: c.id, name: c.name, suggestions: sugg.filter((s) => s.categoryId === c.id).map((s) => s.name) }));
  const saved = mine.map((s) => ({ categoryId: s.categoryId, name: s.name, price: String((s.proPriceCents == null ? s.priceCents : s.proPriceCents) / 100), duration: String(s.durationMin), adultsOnly: s.adultsOnly, photo: s.photoUrl, video: s.videoUrl, videoSec: s.videoSec, addFee: s.proPriceCents == null ? true : s.feeAdded,
    addons: (s.addons ?? []).map((a) => ({ id: a.id, name: a.name, price: String(a.priceCents / 100), minutes: String(a.extraMin) })),
    showOn: s.showOn as "both" | "student" | "partner", forKids: s.forKids, partnerPrice: s.partnerProPriceCents != null ? String(s.partnerProPriceCents / 100) : "" }));
  // "Save & finish later" kept a draft — bring back everything they typed, even unfinished rows.
  const draft = Array.isArray(profile.servicesDraft) ? (profile.servicesDraft as typeof saved) : null;
  const initial = draft ?? saved;
  // Partners: no $150 cap; on both sides they also pick where each service shows and an optional partner-page price.
  const side = await (await import("@/lib/partner-booking")).partnerSides(user.id);
  return (
    <SetupShell steps={steps} current="services" title="What do you do?" edit={edit}>
      <p className="muted small p">Customers search the actual service, not just your category.</p>
      {draft && <div className="card ok small"><span>Welcome back — here&apos;s what you saved. Finish your services, then tap Save &amp; continue.</span></div>}
      <ActionForm action={saveServices} submitLabel={edit ? "Save services" : "Save & continue"} laterLabel={edit ? undefined : "Save & finish later"}
        afterOk={edit ? <EditDoneBar /> : undefined}>
        {edit && <input type="hidden" name="edit" value="1" />}
        <ServicesEditor categories={catProps} initial={initial} userId={user.id} feeCents={Number((await getSettings())["fees.service_fee_cents"] ?? 500)} partner={side.partner} bothSides={side.bothSides} />
      </ActionForm>
    </SetupShell>
  );
}
