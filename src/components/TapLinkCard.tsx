import QRCode from "qrcode";
import { CopyButton } from "@/components/CopyButton";
import { SITE_URL } from "@/lib/public/site";
import { tapLinkFor, tapPoolBatch, tapStats } from "@/lib/tap-links";
import { setTapActive } from "@/app/admin/tap-actions";

/**
 * An owner's GRANTED tap link: the link to write on an NFC tap card, its QR code (backup for phones that don't tap),
 * Pause/Resume and what it brought in. Taps give the scratch-off from the owner's own GRANTED cards.
 */
export async function TapLinkCard({ userId, own }: { userId: string; own: boolean }) {
  const t = await tapLinkFor(userId);
  const [pool, st] = await Promise.all([tapPoolBatch(userId), tapStats(userId)]);
  const url = `${SITE_URL}/t/${t.slug}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
  const status = !t.active ? "Paused — taps open the vote with no reward" : pool ? "On" : "No GRANTED cards with rewards left — taps open the vote with no reward";
  return (
    <div className="card" style={{ gap: 10 }} id="tap-link">
      <span className="eyebrow">{own ? "My tap link" : "Tap link"}</span>
      <span className="small">Write this link on an NFC tap card. When {own ? "you" : "they"} tap someone&apos;s phone, it opens the vote — then they scratch for a reward from {own ? "your" : "their"} GRANTED cards (no number or code to type).</span>
      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${url}`} width={150} height={150} style={{ borderRadius: 8, background: "#fff" }} />
        <div className="col" style={{ gap: 6, minWidth: 0, flex: "1 1 220px" }}>
          <code className="b" style={{ wordBreak: "break-all", fontSize: 15 }}>{url}</code>
          <CopyButton text={url} />
          <span className="xs muted">Status: {status}</span>
          <form action={setTapActive}><input type="hidden" name="userId" value={userId} /><input type="hidden" name="on" value={t.active ? "0" : "1"} /><button className="link xs" type="submit">{t.active ? "Pause tap link" : "Resume tap link"}</button></form>
        </div>
      </div>
      <div className="kpis k4">
        <div className="card" style={{ gap: 2 }}><span className="xs muted">Taps</span><span className="stat">{st.opens}</span></div>
        <div className="card" style={{ gap: 2 }}><span className="xs muted">Votes</span><span className="stat">{st.votes}</span></div>
        <div className="card" style={{ gap: 2 }}><span className="xs muted">Registered</span><span className="stat">{st.registered}</span></div>
        <div className="card" style={{ gap: 2 }}><span className="xs muted">Rewards added</span><span className="stat">{st.added}</span><span className="xs muted">{st.revealed} revealed</span></div>
      </div>
      <span className="xs muted">How to set up the tap card: get a blank NFC card or sticker, open a free app like NFC Tools, choose Write → Add a record → URL, paste the link above and hold the card to the back of your phone. Phones that don&apos;t tap can scan the QR code. Taps use the same rewards as {own ? "your" : "their"} printed cards.</span>
    </div>
  );
}
