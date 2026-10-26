import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";

/**
 * Find by photo — the visual model (runs on Nearest's own server, no outside service).
 *
 * A compact vision model (DeiT-III Small, ImageNet-21k, Apache-2.0, from the ONNX Model Zoo) turns a photo into a
 * 384-number "fingerprint" of what it looks like. Photos of the same look have close fingerprints. The model file is
 * models/look-match/look-v1.onnx (cut to output image features, weights quantized to 8 bits, ~22 MB).
 *
 * Portfolio photos get 10 fingerprints (whole photo + nine close-up areas) so a close-up inspo photo still finds the
 * matching part of a wider portfolio shot. A student's photo gets 3 (whole photo + two centre close-ups).
 */

export const LOOK_MODEL = "deit3s-v1";
const DIM = 384;
const SIZE = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

type Session = import("onnxruntime-web").InferenceSession;
let session: Promise<{ ort: typeof import("onnxruntime-web"); s: Session }> | null = null;

function load() {
  session ??= (async () => {
    const ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1; // serverless functions: no worker threads
    const bytes = await readFile(path.join(process.cwd(), "models", "look-match", "look-v1.onnx"));
    const s = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    return { ort, s };
  })().catch((e) => { session = null; throw e; });
  return session;
}

type Box = [number, number, number, number]; // left, top, width, height as fractions

const PORTFOLIO_BOXES: Box[] = (() => {
  const b: Box[] = [[0, 0, 1, 1]];
  for (const cy of [0.5, 0.3, 0.7]) for (const cx of [0.5, 0.3, 0.7]) b.push([Math.min(Math.max(cx - 0.3, 0), 0.4), Math.min(Math.max(cy - 0.3, 0), 0.4), 0.6, 0.6]);
  return b;
})();
const QUERY_BOXES: Box[] = [[0, 0, 1, 1], [0.15, 0.15, 0.7, 0.7], [0.25, 0.25, 0.5, 0.5]];

async function fingerprints(image: Buffer, boxes: Box[]): Promise<Float32Array[]> {
  const sharp = (await import("sharp")).default;
  const upright = await sharp(image, { failOn: "none" }).rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = upright.info;
  if (!W || !H || W < 32 || H < 32) throw new Error("image too small");
  const { ort, s } = await load();
  const out: Float32Array[] = [];
  for (const [l, t, w, h] of boxes) {
    const region = { left: Math.floor(l * W), top: Math.floor(t * H), width: Math.max(16, Math.floor(w * W)), height: Math.max(16, Math.floor(h * H)) };
    region.width = Math.min(region.width, W - region.left);
    region.height = Math.min(region.height, H - region.top);
    const { data } = await sharp(upright.data).extract(region).resize(SIZE, SIZE, { fit: "cover", kernel: "cubic" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = SIZE * SIZE;
    const input = new Float32Array(3 * px);
    for (let i = 0; i < px; i++) for (let c = 0; c < 3; c++) input[c * px + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
    const res = await s.run({ x: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
    const tokens = Object.values(res)[0].data as Float32Array; // [1, 197, 384] — token 0 is the image summary
    const v = Float32Array.from(tokens.subarray(0, DIM));
    let n = 0;
    for (const x of v) n += x * x;
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < DIM; i++) v[i] /= n;
    out.push(v);
  }
  return out;
}

export const portfolioFingerprints = (image: Buffer) => fingerprints(image, PORTFOLIO_BOXES);
export const queryFingerprints = (image: Buffer) => fingerprints(image, QUERY_BOXES);

/** Packed for the database: per fingerprint a 4-byte scale + 384 signed bytes, all base64. */
export function packVectors(vs: Float32Array[]): string {
  const buf = Buffer.alloc(vs.length * (4 + DIM));
  vs.forEach((v, k) => {
    const o = k * (4 + DIM);
    let max = 0;
    for (const x of v) max = Math.max(max, Math.abs(x));
    const scale = max / 127 || 1;
    buf.writeFloatLE(scale, o);
    for (let i = 0; i < DIM; i++) buf.writeInt8(Math.max(-127, Math.min(127, Math.round(v[i] / scale))), o + 4 + i);
  });
  return buf.toString("base64");
}

export function unpackVectors(s: string): Float32Array[] {
  const buf = Buffer.from(s, "base64");
  const n = Math.floor(buf.length / (4 + DIM));
  const out: Float32Array[] = [];
  for (let k = 0; k < n; k++) {
    const o = k * (4 + DIM);
    const scale = buf.readFloatLE(o);
    const v = new Float32Array(DIM);
    for (let i = 0; i < DIM; i++) v[i] = buf.readInt8(o + 4 + i) * scale;
    out.push(v);
  }
  return out;
}

/** Best match between any area of the student's photo and any area of the portfolio photo (cosine, 0–1). */
export function bestSimilarity(query: Float32Array[], photo: Float32Array[]): number {
  let best = -1;
  for (const q of query) for (const p of photo) {
    let d = 0;
    for (let i = 0; i < DIM; i++) d += q[i] * p[i];
    if (d > best) best = d;
  }
  return best;
}
