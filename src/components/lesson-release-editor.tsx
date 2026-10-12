"use client";
import { useEffect, useState } from "react";

interface Note { id: string; topic: string; className: string; sectionName: string;
  termName: string; currentRevision: number; released: boolean; withdrawn: boolean }
export function LessonReleaseEditor({ schoolId }: { schoolId: string }) {
  const [items, setItems] = useState<Note[]>([]);
  const [chosen, setChosen] = useState<Note | null>(null);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`/api/schools/${encodeURIComponent(schoolId)}/lesson-releases`,
      { credentials: "same-origin", cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (live) { setItems(data.notes); setChosen(null); } })
      .catch(() => { if (live) { setMessage("Review access unavailable or revoked."); setItems([]); } });
    return () => { live = false; };
  }, [schoolId, refresh]);
  async function change(action: "RELEASE" | "WITHDRAW") {
    if (!chosen || busy || !ack || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const res = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/lesson-releases/${encodeURIComponent(chosen.id)}/decision`,
        { method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, expectedRevision: chosen.currentRevision, reason }),
        });
      setMessage(res.ok ? "Immutable lesson release decision recorded."
        : "Release denied, stale, or section access revoked. Refresh the list.");
      setChosen(null); setReason(""); setAck(false); setRefresh(v => v + 1);
    } catch {
      setMessage("Network error. No release was confirmed.");
    } finally { setBusy(false); }
  }
  return <section className="school-card" aria-label="Approved lesson release controls">
    <h2>Approved lesson release</h2>
    <p>Approval alone never releases content. Release and withdrawal require a separate verified section decision.</p>
    <button type="button" disabled={busy} onClick={() => setRefresh(v => v + 1)}>Refresh</button>
    <ul>{items.map(note => <li key={note.id}>
      {note.topic} — {note.className} ({note.sectionName}, {note.termName}) ·{" "}
      {note.withdrawn ? "Withdrawn" : note.released ? "Released" : "Approved only"}
      {!note.withdrawn && <button type="button" disabled={busy}
        onClick={() => { setChosen(note); setAck(false); setReason(""); }}>Review publication</button>}
    </li>)}</ul>
    {chosen && <section aria-label="Release decision">
      <h3>{chosen.topic} — revision {chosen.currentRevision}</h3>
      <label htmlFor="release-reason">Publication decision reason</label>
      <textarea id="release-reason" minLength={5} maxLength={500}
        value={reason} onChange={e => setReason(e.target.value)} />
      <label><input type="checkbox" checked={ack}
        onChange={e => setAck(e.target.checked)} />
        I verified the approved revision and class/term before publication.</label>
      <button type="button" disabled={!ack || reason.trim().length < 5 || busy}
        onClick={() => change(chosen.released ? "WITHDRAW" : "RELEASE")}>
        {chosen.released ? "Withdraw released note" : "Release approved note"}
      </button>
    </section>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
