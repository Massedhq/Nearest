"use client";

/**
 * Plays a Learn at Nearest class inside the app only: streamed through /api/learn/[id]/video (refuses new tabs and
 * other sites), no download button, no picture-in-picture, no right-click menu, and the viewer's name over the video.
 * Note: a web page can't detect screen recording; full protection comes later from a DRM video service.
 */
export function LearnPlayer({ id, title, watermark }: { id: string; title: string; watermark: string }) {
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000" }} onContextMenu={(e) => e.preventDefault()}>
      <video
        src={`/api/learn/${id}/video`}
        poster={`/api/learn/${id}/cover`}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        playsInline
        preload="metadata"
        aria-label={title}
        style={{ display: "block", width: "100%", maxHeight: "70vh", background: "#000" }}
      />
      <span aria-hidden style={{ position: "absolute", right: 12, top: 10, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.55)", textShadow: "0 1px 3px rgba(0,0,0,.8)", pointerEvents: "none" }}>{watermark}</span>
    </div>
  );
}
