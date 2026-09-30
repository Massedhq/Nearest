import "server-only";

/**
 * Reads a video's length (seconds) from its own header — MP4 and iPhone MOV store it in the "mvhd" box
 * inside "moov". Only the few bytes needed are fetched (HTTP Range); if the server ignores Range, the file
 * is read once in full. Returns null if the length can't be read (not an MP4/MOV, or damaged).
 */
export async function videoSeconds(url: string): Promise<number | null> {
  let whole: Uint8Array | null = null;
  let total: number | null = null;

  async function read(start: number, len: number): Promise<Uint8Array | null> {
    if (whole) return whole.subarray(start, Math.min(whole.length, start + len));
    const res = await fetch(url, { headers: { Range: `bytes=${start}-${start + len - 1}` }, cache: "no-store" });
    if (res.status === 206) {
      const m = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "");
      if (m) total = Number(m[1]);
      return new Uint8Array(await res.arrayBuffer());
    }
    if (res.ok) { // Range not supported: keep the whole file in memory for the rest of the reads
      whole = new Uint8Array(await res.arrayBuffer());
      total = whole.length;
      return whole.subarray(start, Math.min(whole.length, start + len));
    }
    return null;
  }

  const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
  const u64 = (b: Uint8Array, o: number) => u32(b, o) * 2 ** 32 + u32(b, o + 4);
  const type = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

  try {
    // Walk the top-level boxes to find "moov" (phones often put it at the end of the file).
    let off = 0;
    for (let i = 0; i < 64; i++) {
      const h = await read(off, 16);
      if (!h || h.length < 8) return null;
      let size = u32(h, 0);
      const t = type(h, 4);
      let header = 8;
      if (size === 1) { if (h.length < 16) return null; size = u64(h, 8); header = 16; }
      else if (size === 0) size = (total ?? off) - off; // box runs to the end of the file
      if (t === "moov") {
        // "mvhd" is a child of moov; scan moov's children for it.
        let c = off + header;
        const end = off + size;
        for (let j = 0; j < 64 && c < end; j++) {
          const ch = await read(c, 40);
          if (!ch || ch.length < 8) return null;
          const csize = u32(ch, 0);
          if (type(ch, 4) === "mvhd") {
            const version = ch[8];
            if (version === 1) {
              const b = await read(c + 8, 4 + 8 + 8 + 4 + 8);
              if (!b || b.length < 32) return null;
              const timescale = u32(b, 20), duration = u64(b, 24);
              return timescale ? duration / timescale : null;
            }
            const timescale = u32(ch, 20), duration = u32(ch, 24);
            return timescale ? duration / timescale : null;
          }
          if (csize < 8) return null;
          c += csize;
        }
        return null;
      }
      if (size < 8) return null;
      off += size;
      if (total !== null && off >= total) return null;
    }
    return null;
  } catch {
    return null;
  }
}
