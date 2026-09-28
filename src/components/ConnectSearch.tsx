"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { findStudents, connectWith } from "@/app/connection-actions";

type Result = { id: string; name: string; school: string | null; state: string };

/** Search verified students by name or username, then Connect. */
export function ConnectSearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    if (q.trim().length < 2) { setRows([]); return; }
    t.current = setTimeout(async () => { setBusy(true); try { setRows(await findStudents(q)); } finally { setBusy(false); } }, 300);
  }, [q]);
  async function connect(id: string) {
    const r = await connectWith(id);
    setMsg((m) => ({ ...m, [id]: r.error ?? r.ok ?? "" }));
    if (!r.error) setRows((x) => x.map((p) => (p.id === id ? { ...p, state: r.ok === "Connected." ? "connected" : "requested" } : p)));
  }
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="field">
        <label htmlFor="conn-q" className="row" style={{ gap: 6 }}><Icon name="search" size="s" /> Find a student by name or username</label>
        <input id="conn-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Maya Johnson or @mayaj27" autoComplete="off" autoCapitalize="none" />
      </div>
      {busy && <span className="xs muted">Searching…</span>}
      {!busy && q.trim().length >= 2 && rows.length === 0 && <span className="small muted">No students found. Students under 18 can be found by name only by classmates at their school — ask them for their username.</span>}
      {rows.map((r) => (
        <div key={r.id} className="item">
          <span className="grow"><span className="b">{r.name}</span>{r.school && <span className="xs muted"> • {r.school}</span>}{msg[r.id] && <span className="xs" style={{ display: "block" }}>{msg[r.id]}</span>}</span>
          {r.state === "connected" ? <span className="tag ok">Connected</span>
            : r.state === "requested" ? <span className="tag">Requested</span>
            : <button type="button" className="btn sm" onClick={() => connect(r.id)}>{r.state === "incoming" ? "Accept" : "Connect"}</button>}
        </div>
      ))}
    </div>
  );
}
