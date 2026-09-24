import Image from "next/image";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { Uploader } from "@/components/Uploader";
import { Icon } from "@/components/Icon";
import { saveProfile, saveAvatar } from "@/app/pro/actions";

export const metadata = { title: "Profile" };

export default async function ProfileStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, profile: p } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const steps = await setupSteps(user.id);
  return (
    <SetupShell steps={steps} current="profile" title="Build your professional profile" edit={edit}>
      <div className="row">
        {p.photoUrl ? (
          <Image src={p.photoUrl} alt="Your profile photo" width={84} height={84} style={{ borderRadius: 42, objectFit: "cover" }} />
        ) : (
          <div className="avatar lg"><Icon name="camera" size="l" /></div>
        )}
        <div className="grow"><Uploader userId={user.id} folder="avatar" save={saveAvatar} multiple={false} label={p.photoUrl ? "Change photo or logo" : "Upload photo or logo"} /></div>
      </div>
      <ActionForm action={saveProfile} submitLabel={edit ? "Save" : "Save & continue"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        <div className="field"><label htmlFor="businessName">Business / professional name</label><input id="businessName" name="businessName" defaultValue={p.businessName ?? ""} required /></div>
        <div className="field"><label htmlFor="bio">About me</label><textarea id="bio" name="bio" defaultValue={p.bio ?? ""} placeholder="Tell customers about your work and experience." required /></div>
        <div className="field"><label htmlFor="years">Years of experience (optional)</label><input id="years" name="years" inputMode="numeric" defaultValue={p.yearsExperience ?? ""} /></div>
        <span className="lbl">Links (optional)</span>
        <div className="field"><label htmlFor="instagram">Instagram</label><input id="instagram" name="instagram" placeholder="@handle" defaultValue={p.instagram ? `@${p.instagram}` : ""} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="tiktok">TikTok</label><input id="tiktok" name="tiktok" placeholder="@handle" defaultValue={p.tiktok ? `@${p.tiktok}` : ""} /></div>
          <div className="field"><label htmlFor="website">Website</label><input id="website" name="website" placeholder="https://" defaultValue={p.website ?? ""} /></div>
        </div>
        <label className="check"><input type="checkbox" name="showInstagram" defaultChecked={p.showInstagram} />Show my Instagram link on my profile</label>
      </ActionForm>
    </SetupShell>
  );
}
