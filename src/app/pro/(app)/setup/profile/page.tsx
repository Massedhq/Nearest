import Image from "next/image";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { SocialField } from "@/components/SocialField";
import { ensureProSlug } from "@/lib/connections";
import { FollowNearest } from "@/components/FollowNearest";
import { instagramUrl, tiktokUrl } from "@/lib/social";
import { ActionForm } from "@/components/ActionForm";
import { Uploader } from "@/components/Uploader";
import { Icon } from "@/components/Icon";
import { saveProfile, saveAvatar, saveLogo } from "@/app/pro/actions";

export const metadata = { title: "Profile" };

export default async function ProfileStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, profile: p } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const steps = await setupSteps(user.id);
  const slug = await ensureProSlug(user.id);
  return (
    <SetupShell steps={steps} current="profile" title="Build your professional profile" edit={edit}>
      <span className="lbl">Photo of you</span>
      <div className="row">
        {p.photoUrl ? (
          <Image src={p.photoUrl} alt="Photo of you" width={84} height={84} style={{ borderRadius: 42, objectFit: "cover" }} />
        ) : (
          <div className="avatar lg"><Icon name="camera" size="l" /></div>
        )}
        <div className="grow col" style={{ gap: 4 }}>
          <Uploader userId={user.id} folder="avatar" save={saveAvatar} multiple={false} label={p.photoUrl ? "Change your photo" : "Upload a photo of you"} />
          <span className="xs muted">A clear, friendly photo of your face, so clients know who they&apos;re booking.</span>
        </div>
      </div>
      <span className="lbl">Business logo (optional)</span>
      <div className="row">
        {p.logoUrl ? (
          <Image src={p.logoUrl} alt="Your business logo" width={64} height={64} style={{ borderRadius: 12, objectFit: "cover" }} />
        ) : (
          <div className="avatar" style={{ borderRadius: 12 }}><Icon name="store" /></div>
        )}
        <div className="grow"><Uploader userId={user.id} folder="logo" save={saveLogo} multiple={false} label={p.logoUrl ? "Change logo" : "Upload your logo"} /></div>
      </div>
      <FollowNearest />
      <ActionForm action={saveProfile} submitLabel={edit ? "Save" : "Save & continue"} laterLabel={edit ? undefined : "Save & finish later"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        <div className="field"><label htmlFor="displayName">Your name (as clients will see it)</label><input id="displayName" name="displayName" defaultValue={p.displayName ?? [user.firstName, user.lastName ? `${user.lastName[0]}.` : ""].filter(Boolean).join(" ")} maxLength={60} required /><span className="xs muted">The person clients are booking — for example &ldquo;Jasmine C.&rdquo;</span></div>
        <div className="field"><label htmlFor="businessName">Business name</label><input id="businessName" name="businessName" defaultValue={p.businessName ?? ""} maxLength={80} required /><span className="xs muted">Your salon, studio or brand. No business name yet? Use your own name.</span></div>
        <div className="field"><label htmlFor="bio">About me</label><textarea id="bio" name="bio" defaultValue={p.bio ?? ""} placeholder="Tell customers about your work and experience." required /></div>
        <div className="field">
          <label htmlFor="slug">Your booking link</label>
          <div className="row" style={{ gap: 0 }}><span className="small muted" style={{ whiteSpace: "nowrap", paddingRight: 4 }}>usenearest.com/pro-</span><input id="slug" name="slug" defaultValue={slug ?? ""} placeholder="kisses" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={30} /></div>
          <span className="xs muted">Letters, numbers and dashes. This is the link you share so students can book you.</span>
        </div>
        <div className="field"><label htmlFor="years">Years of experience (optional)</label><input id="years" name="years" inputMode="numeric" defaultValue={p.yearsExperience ?? ""} /></div>
        <span className="lbl">Your social links (optional)</span>
        <p className="xs muted p" style={{ margin: 0 }}>Paste the link to each profile. They show on your Nearest profile as icons students can tap to open your page.</p>
        <SocialField kind="instagram" defaultValue={p.instagram ? instagramUrl(p.instagram) : ""} />
        <SocialField kind="tiktok" defaultValue={p.tiktok ? tiktokUrl(p.tiktok) : ""} />
      </ActionForm>
    </SetupShell>
  );
}
