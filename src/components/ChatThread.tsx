"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { sendMessage } from "@/app/day-actions";
import type { FormState } from "./ActionForm";
import { Icon } from "./Icon";

type Msg = { id: string; mine: boolean; body: string; at: string };
const QUICK = ["I'm here.", "Running a few minutes late", "Where should I park?", "I need help finding the location"];

/** Booking chat. Checks for new messages every 8 seconds while open. */
export function ChatThread({ bookingId, as, open }: { bookingId: string; as: "student" | "pro"; open: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const [state, run, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await sendMessage(prev, fd);
    if (r.ok) { setText(""); await load(); }
    return r;
  }, {});

  async function load() {
    const res = await fetch(`/api/bookings/${bookingId}/messages`, { cache: "no-store" });
    if (res.ok) setMsgs(await res.json());
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  return (
    <div className="col" style={{ gap: 10, flex: 1 }}>
      <div className="col" style={{ gap: 8, minHeight: 240 }} aria-live="polite">
        {msgs.length === 0 && <p className="small muted p" style={{ textAlign: "center" }}>No messages yet.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble${m.mine ? " me" : ""}`}>
            {m.body}
            <div className="xs" style={{ opacity: 0.6, marginTop: 2 }}>{new Date(m.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {open ? (
        <form action={run} className="col" style={{ gap: 8 }}>
          <input type="hidden" name="id" value={bookingId} />
          <input type="hidden" name="as" value={as} />
          <div className="scrollx" style={{ marginRight: 0, overflowX: "auto" }}>
            {QUICK.map((q) => <button key={q} type="button" className="chip" onClick={() => setText(q)}>{q}</button>)}
          </div>
          <div className="row">
            <label className="search grow" htmlFor="chatbody" style={{ height: 48 }}><input id="chatbody" name="body" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" maxLength={1000} /></label>
            <button className="iconbtn" type="submit" aria-label="Send" disabled={pending || !text.trim()} style={{ background: "#ECE8E1", color: "#0A0A0A" }}><Icon name="send" /></button>
          </div>
          {state.error && <p className="err">{state.error}</p>}
        </form>
      ) : (
        <p className="xs muted p" style={{ textAlign: "center" }}>This conversation is closed.</p>
      )}
      <p className="xs muted p" style={{ textAlign: "center" }}>Phone numbers stay private. Messaging closes 90 days after the appointment.</p>
    </div>
  );
}
