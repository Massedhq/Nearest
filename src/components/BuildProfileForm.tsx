"use client";
import { useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { readScreenshotText } from "@/lib/ocr-client";
import { parseLeadText } from "@/lib/lead-parse";
import { createBuiltProfile, readBuildDetails } from "@/app/admin/build-actions";
import { partnerSetupHandoff } from "@/app/admin/partner-actions";
import { saveAvatar, saveLogo } from "@/app/pro/actions";
import { CityPicker } from "./CityPicker";

type Opt = { id: number; name: string; state?: string };
export type BuildInitial = { firstName: string; lastName: string; email: string; phone: string; businessName: string; categoryId: number | null; cityId: number | null; prospectId: string | null };

const MAX_SHOTS = 5;

/** Shrinks a picture (longest side `max` px, JPEG) so uploads stay small. Text and faces stay sharp. */
async function shrink(file: File, max: number): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.86));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}

/**
 * Build a profile — one form. Screenshots are optional: when added, their text is read on this device (no AI
 * service) and fills in the name, contact details, business, main category and city — plus address, Instagram,
 * prices and more saved straight onto the profile. Their photo and logo are optional too. Creating the profile opens
 * the first setup step that's still missing.
 */
export function BuildProfileForm({ categories, cities, initial, partner = false }: { categories: Opt[]; cities: Opt[]; initial: BuildInitial; partner?: boolean }) {
  const [v, setV] = useState({ ...initial, categoryId: initial.categoryId ? String(initial.categoryId) : "", cityId: initial.cityId ? String(initial.cityId) : "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const [shots, setShots] = useState<File[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [found, setFound] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [after, setAfter] = useState("");
  const photoSrc = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  const logoSrc = useMemo(() => (logo ? URL.createObjectURL(logo) : ""), [logo]);

  async function readShots() {
    setErr(""); setNote("");
    if (!shots.length) return setErr("Choose at least one screenshot.");
    try {
      const { texts, error } = await readScreenshotText(shots, setBusy);
      const parsed = parseLeadText(texts);
      setBusy("Matching their category and city…");
      const r = await readBuildDetails(parsed.fields as unknown as Record<string, unknown>);
      const f = r.fields;
      const [first, ...rest] = f.name.trim().split(/\s+/);
      setV((x) => ({
        ...x,
        firstName: x.firstName || first || "", lastName: x.lastName || rest.join(" "),
        email: x.email || f.email, phone: x.phone || f.phone, businessName: x.businessName || f.business,
        categoryId: x.categoryId || (f.categoryId ? String(f.categoryId) : ""), cityId: x.cityId || (r.cityId ? String(r.cityId) : ""),
      }));
      setExtra(f as unknown as Record<string, unknown>);
      const labels: [string, unknown][] = [["name", f.name], ["email", f.email], ["phone", f.phone], ["business", f.business], ["category", f.categoryId], ["city", r.cityId], ["address", f.address], ["Instagram", f.instagram], ["website", f.website || f.bookingLink], ["hours", f.hours], ["prices", f.prices], ["credentials", f.credentials]];
      setFound(labels.filter(([, x]) => x).map(([k]) => k));
      setNote([error, r.note, parsed.conflicts.length ? `Check: ${parsed.conflicts.join("; ")}.` : ""].filter(Boolean).join(" "));
    } catch (e) { console.error(e); setErr("Couldn't read those screenshots — fill in the details below."); }
    setBusy("");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setAfter("");
    if (!v.cityId) { document.getElementById("bp-city")?.focus(); return setErr("Choose the city they provide services in."); }
    const fd = new FormData(e.currentTarget);
    fd.set("extra", JSON.stringify(extra));
    if (initial.prospectId) fd.set("prospectId", initial.prospectId);
    if (partner) fd.set("partner", "1");
    setBusy("Creating their account…");
    let r: Awaited<ReturnType<typeof createBuiltProfile>>;
    try { r = await createBuiltProfile(fd); } catch (x) { console.error(x); setBusy(""); return setErr("Something went wrong. Try again."); }
    if ("error" in r) { setBusy(""); return setErr(r.error); }
    const problems: string[] = [];
    const put = async (file: File, folder: string, save: (urls: string[]) => Promise<{ error?: string }>, label: string) => {
      try {
        setBusy(`Uploading their ${label}…`);
        const blob = await upload(`pros/${r.userId}/${folder}/${Date.now()}.jpg`, await shrink(file, 1400), { access: "public", handleUploadUrl: "/api/blob" });
        const s = await save([blob.url]);
        if (s.error) problems.push(`${label}: ${s.error}`);
      } catch (x) { console.error(x); problems.push(`${label} didn't upload`); }
    };
    if (r.next.startsWith("/admin") && !r.handoff) { window.location.href = r.next; return; } // existing professional made a partner — nothing to upload
    if (photo) await put(photo, "avatar", saveAvatar, "photo");
    if (logo) await put(logo, "logo", saveLogo, "logo");
    if (shots.length) {
      try {
        setBusy("Saving their screenshots…");
        const sf = new FormData();
        sf.set("userId", r.userId); sf.set("fields", JSON.stringify(extra));
        for (const s of shots) sf.append("shots", await shrink(s, 2000), s.name.replace(/\.\w+$/, "") + ".jpg");
        const res = await fetch("/api/admin/build-screenshots", { method: "POST", body: sf });
        if (!res.ok) problems.push((await res.json().catch(() => ({}))).error || "screenshots didn't save");
      } catch (x) { console.error(x); problems.push("screenshots didn't save"); }
    }
    if (r.handoff === "setup") {
      setBusy("Emailing their setup link…");
      const h = await partnerSetupHandoff(r.userId).catch(() => ({ error: "The setup link didn't send — send it from the list below." }));
      if ("error" in h) problems.push(h.error);
    }
    if (problems.length) { setBusy(""); setErr(`Their profile was created, but: ${problems.join("; ")}. You can add those on their Profile step.`); setAfter(r.next); return; }
    setBusy(r.handoff === "setup" ? "Done — back to Partner pages…" : "Opening their profile…");
    window.location.href = r.next;
  }

  const pick = (label: string, id: string, src: string, onPick: (f: File | null) => void, round: boolean) => (
    <div className="field" style={{ flex: 1, minWidth: 200 }}>
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ gap: 10 }}>
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt="" width={56} height={56} style={{ borderRadius: round ? 28 : 10, objectFit: "cover" }} />
          : <div className="avatar" style={{ borderRadius: round ? 28 : 10 }} />}
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" style={{ paddingTop: 12 }} onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="col g16">
      <div className="card" style={{ gap: 8, background: "transparent" }}>
        <span className="eyebrow">Screenshots (optional)</span>
        <span className="xs muted">Their profile, link-in-bio, booking page or flyer. The text is read on this device and fills in the form — category and city too. They&apos;re kept with their record so you can see them while you build. Skip this if you&apos;d rather type it in.</span>
        <input id="bp-shots" type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ paddingTop: 12 }}
          onChange={(e) => { const l = Array.from(e.target.files ?? []); setErr(l.length > MAX_SHOTS ? `Choose up to ${MAX_SHOTS} screenshots.` : ""); setShots(l.slice(0, MAX_SHOTS)); setFound([]); }} />
        {shots.length > 0 && <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} disabled={Boolean(busy)} onClick={readShots}>Read {shots.length} screenshot{shots.length === 1 ? "" : "s"} and fill in the form</button>}
        {found.length > 0 && <span className="small okmsg">Filled in from the screenshots: {found.join(", ")}. Check them below.</span>}
        {note && <span className="small warn" style={{ color: "#E3C58A" }}>{note}</span>}
      </div>

      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        {pick("Photo of them (optional)", "bp-photo", photoSrc, setPhoto, true)}
        {pick("Business logo (optional)", "bp-logo", logoSrc, setLogo, false)}
      </div>

      <div className="grid2">
        <p className="xs muted" style={{ gridColumn: "1 / -1", margin: 0 }}>Legal name = the name on their government ID. Never their business name or anything made from it.</p>
        <div className="field"><label htmlFor="bp-first">Legal first name</label><input id="bp-first" name="firstName" required maxLength={60} value={v.firstName} onChange={set("firstName")} /></div>
        <div className="field"><label htmlFor="bp-last">Legal last name</label><input id="bp-last" name="lastName" required maxLength={60} value={v.lastName} onChange={set("lastName")} /></div>
        <div className="field"><label htmlFor="bp-email">Their email (their sign-in)</label><input id="bp-email" name="email" type="email" required maxLength={160} value={v.email} onChange={set("email")} /></div>
        <div className="field"><label htmlFor="bp-phone">Their phone (optional)</label><input id="bp-phone" name="phone" maxLength={30} value={v.phone} onChange={set("phone")} /></div>
        <div className="field"><label htmlFor="bp-bus">Business name (optional)</label><input id="bp-bus" name="businessName" maxLength={80} value={v.businessName} onChange={set("businessName")} /></div>
        <div className="field"><label htmlFor="bp-cat">Main service category</label>
          <select id="bp-cat" name="categoryId" required value={v.categoryId} onChange={set("categoryId")}><option value="">Choose a category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <CityPicker cities={cities} value={v.cityId} onChange={(id) => setV((x) => ({ ...x, cityId: id }))} id="bp-city" label="City they provide services in" />
      </div>
      {partner && (
        <div className="col g8">
          <div className="field"><label htmlFor="bp-ig">Their Instagram (optional)</label><input id="bp-ig" name="instagram" maxLength={120} placeholder="@theirhandle or instagram.com/theirhandle" /></div>
          <span className="lbl">After adding them</span>
          <label className="check small" style={{ alignItems: "flex-start" }}><input type="radio" name="handoff" value="build" defaultChecked /><span><b>I&apos;ll build their profile now.</b> Their setup pages open next. When you&apos;re done (or partway), send them the finish link or the approve link from Partner pages.</span></label>
          <label className="check small" style={{ alignItems: "flex-start" }}><input type="radio" name="handoff" value="setup" /><span><b>They&apos;ll set it up themselves.</b> Their setup link is emailed to them now.</span></label>
        </div>
      )}
      <label className="check small" style={{ alignItems: "flex-start" }}><input type="checkbox" name="permission" required /><span>They gave me permission to create their Nearest account{partner ? " as a Nearest Partner" : ""} and set up their profile for them.</span></label>
      {busy && <span className="small" role="status" aria-live="polite">{busy}</span>}
      {err && <p className="err" role="alert">{err}</p>}
      {after ? <a className="btn" href={after}>{after.startsWith("/admin") ? "Back to Partner pages" : "Continue building their profile"}</a>
        : <button className="btn" type="submit" disabled={Boolean(busy)}>{busy ? "Working…" : partner ? "Add partner" : "Create and start building"}</button>}
    </form>
  );
}
