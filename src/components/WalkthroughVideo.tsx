import { WALKTHROUGH, WALKTHROUGH_TRANSCRIPT } from "@/lib/walkthrough";

/** Narrated walkthrough player: controls, poster, no autoplay (sound only plays when the viewer presses play), and a transcript. */
export function WalkthroughVideo({ heading = "Watch a short walkthrough of Nearest" }: { heading?: string }) {
  return (
    <section className="col" style={{ gap: 8 }} aria-label="Nearest walkthrough video">
      <span className="eyebrow">{heading}</span>
      <video
        controls
        playsInline
        preload="metadata"
        poster={WALKTHROUGH.poster}
        width={WALKTHROUGH.width}
        height={WALKTHROUGH.height}
        style={{ width: "100%", height: "auto", maxHeight: "78vh", objectFit: "contain", borderRadius: 14, background: "#0B0B0C", alignSelf: "center" }}
      >
        <source src={WALKTHROUGH.src} type="video/mp4" />
        Your browser can&apos;t play this video. The transcript below has everything it says.
      </video>
      <span className="xs muted">{WALKTHROUGH.length} · Captions are shown in the video. Recorded in the real Nearest app with demonstration accounts and sample data — no real students, bookings or payments. Booking and appointment-day steps are shown as previews.</span>
      <details className="card small" style={{ gap: 8 }}>
        <summary className="b" style={{ cursor: "pointer" }}>Read the transcript</summary>
        {WALKTHROUGH_TRANSCRIPT.map((s) => (
          <div key={s.title} className="col" style={{ gap: 2, marginTop: 8 }}>
            <span className="b">{s.title}</span>
            <span>{s.text}</span>
          </div>
        ))}
      </details>
    </section>
  );
}
