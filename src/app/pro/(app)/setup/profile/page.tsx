import Image from "next/image";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { SocialField } from "@/components/SocialField";
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
        <SocialField kind="instagram" defaultValue={p.instagram ? `@${p.instagram}` : ""} />
        <div className="grid2">
          <SocialField kind="tiktok" defaultValue={p.tiktok ? `@${p.tiktok}` : ""} />
          <SocialField kind="website" defaultValue={p.website ?? ""} />
        </div>
        <p className="xs muted p">Students can tap these icons on your profile to open your pages.</p>
      </ActionForm>
    </SetupShell>
  );
}
