"use client";
/**
 * Reads the text in screenshots inside the browser with Tesseract OCR. The worker, engine (WebAssembly) and English
 * language file are self-hosted under /ocr (public/ocr), so screenshots never go to an outside OCR or AI service and
 * no API key is needed. Each screenshot is read twice with different clean-ups (inverted grayscale, then high-contrast
 * black and white) — the second pass picks up text on stylized flyers — and both texts go to the parser.
 */

type Worker = { recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };

async function loadImage(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  try { return await createImageBitmap(file); } catch {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Couldn't open that image.")); i.src = url; });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
  }
}

/** Enlarges small text, makes it grayscale, turns light-on-dark into dark-on-light; "thr" also makes it pure black/white. */
function prepare(img: CanvasImageSource & { width: number; height: number }, mode: "inv" | "thr") {
  const scale = Math.max(0.5, Math.min(2, 2600 / img.width));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height); const p = d.data;
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) { const y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = y; sum += y; }
  const dark = sum / (p.length / 4) < 128;
  for (let i = 0; i < p.length; i += 4) { let y = p[i]; if (dark) y = 255 - y; if (mode === "thr") y = y > 150 ? 255 : 0; p[i] = p[i + 1] = p[i + 2] = y; }
  g.putImageData(d, 0, 0);
  return c;
}

/**
 * Reads every screenshot. Returns, per screenshot, the texts of its passes (empty when it couldn't be read) and an
 * error message if the reader itself couldn't start or a screenshot failed — the caller still saves the screenshots.
 */
export async function readScreenshotText(files: Blob[], onProgress?: (msg: string) => void): Promise<{ texts: string[][]; error: string }> {
  const texts: string[][] = files.map(() => []);
  let worker: Worker;
  try {
    onProgress?.("Starting the screenshot reader…");
    const { createWorker } = await import("tesseract.js");
    worker = (await createWorker("eng", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr/core", langPath: "/ocr/lang", gzip: true })) as unknown as Worker;
  } catch (e) {
    console.error("ocr start", e);
    return { texts, error: "The screenshot reader couldn't start in this browser, so nothing was filled in." };
  }
  const failed: number[] = [];
  try {
    for (let i = 0; i < files.length; i++) {
      onProgress?.(`Reading screenshot ${i + 1} of ${files.length}…`);
      try {
        const img = await loadImage(files[i]);
        for (const mode of ["inv", "thr"] as const) texts[i].push((await worker.recognize(prepare(img, mode))).data.text ?? "");
      } catch (e) { console.error("ocr read", e); failed.push(i + 1); }
    }
  } finally { await worker.terminate().catch(() => {}); }
  return { texts, error: failed.length ? `Screenshot${failed.length > 1 ? "s" : ""} ${failed.join(", ")} couldn't be read.` : "" };
}
