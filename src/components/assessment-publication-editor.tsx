"use client";
import { useEffect, useState } from "react";

interface Draft {
  id: string; kind: "QUIZ" | "TEST" | "EXAM"; title: string;
  className: string; subjectName: string; startsAt: string; endsAt: string;
  durationMinutes: number; maxAttempts: number; passPercent: number;
  published: boolean; withdrawn: boolean;
}
export function AssessmentPublicationEditor({ schoolId }: { schoolId: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    fetch(`/api/schools/${encodeURIComponent(schoolId)}/assessment-publications`,
      { cache: "no-store", credentials: "same-origin" })
      .then(async response => { if (!response.ok) throw Error(); return response.json(); })
      .then(data => { if (live) { setDrafts(data.drafts); setSelected(null); } })
      .catch(() => { if (live) { setDrafts([]); setMessage("Publication access unavailable."); } });
    return () => { live = false; };
  }, [schoolId, refresh]);
  async function save() {
    if (!selected || !confirmed || reason.trim().length < 5 || working) return;
    const action = selected.published ? "WITHDRAWN" : "PUBLISHED";
    setWorking(true); setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-publications/${encodeURIComponent(selected.id)}/decision`,
        { method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        });
      setMessage(response.ok
        ? "Immutable publication decision recorded. CBT student delivery is still disabled."
        : "Publication denied or already decided. Check approval and school access.");
      setSelected(null); setReason(""); setConfirmed(false);
      setRefresh(n => n + 1);
    } catch {
      setMessage("Request failed; no publication change confirmed.");
    } finally { setWorking(false); }
  }
  return <section className="school-card" aria-label="Assessment publication administration">
    <h2>Separate school publication ledger</h2>
    <p>Only explicitly approved, sealed configurations can receive a publication event. This development screen does not enable student examinations. Withdrawal is permanent for that draft.</p>
    <button type="button" disabled={working}
      onClick={() => setRefresh(v => v + 1)}>Refresh</button>
    <ul>{drafts.map(d => <li key={d.id}>
      <strong>{d.kind}: {d.title}</strong> · {d.className} / {d.subjectName} ·
      {d.durationMinutes} minutes · {d.maxAttempts} attempts ·
      {d.passPercent}% pass · {d.withdrawn ? "Withdrawn" :
        d.published ? "Publication event recorded" : "Approved only"}
      {!d.withdrawn && <button type="button" disabled={working}
        onClick={() => { setSelected(d); setReason(""); setConfirmed(false); }}>
        {d.published ? "Review permanent withdrawal" : "Review publication"}
      </button>}
    </li>)}</ul>
    {selected && <section aria-label="Publication decision">
      <h3>{selected.title} — {selected.className}</h3>
      <p>UTC window: {selected.startsAt} to {selected.endsAt}.</p>
      <p>Action: {selected.published ? "Withdraw permanently" : "Record publication authorization"}</p>
      <label htmlFor="publication-reason">Reason (5–500 characters)</label>
      <textarea id="publication-reason" minLength={5} maxLength={500} required
        value={reason} onChange={e => setReason(e.target.value)} />
      <label><input type="checkbox" checked={confirmed}
        onChange={e => setConfirmed(e.target.checked)} />
        I confirm the correct school, class, assessment, timing and irreversible action.</label>
      <button type="button" disabled={working || !confirmed || reason.trim().length < 5}
        onClick={save}>Record audited decision</button>
    </section>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
