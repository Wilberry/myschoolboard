"use client";
import { useEffect, useState, type FormEvent } from "react";

type FinalDecision = {
  id: string; evidenceId: string; className: string; subjectName: string;
  evidenceRevision: number; ordinal: number; status: string;
};
type Packet = {
  id: string; finalDecisionId: string; evidenceRevision: number;
  finalDecisionOrdinal: number; studentCount: number;
};

export function ReportCardSourceWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const [decisions, setDecisions] = useState<FinalDecision[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [finalDecisionId, setFinalDecisionId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`${root}/result-final-publication-decisions`, { cache: "no-store" }),
      fetch(`${root}/report-card-source-packets`, { cache: "no-store" }),
    ]).then(async ([d, p]) => {
      if (!d.ok || !p.ok) throw new Error();
      return Promise.all([d.json(), p.json()]);
    }).then(([d, p]) => {
      if (live) { setDecisions(d.decisions); setPackets(p.packets); }
    }).catch(() => {
      if (live) { setDecisions([]); setPackets([]);
        setMessage("Private source records unavailable. Nothing was released."); }
    });
    return () => { live = false; };
  }, [root, refresh]);
  const eligible = decisions.filter(d => d.status === "APPROVED_AWAITING_RELEASE" &&
    !packets.some(p => p.finalDecisionId === d.id));
  async function freeze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !finalDecisionId || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${root}/report-card-source-packets`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalDecisionId, reason }),
      });
      if (!response.ok) throw new Error();
      setMessage("Immutable private source prepared. No official grade or report was released.");
      setFinalDecisionId(""); setReason(""); setRefresh(v => v + 1);
    } catch {
      setMessage("Preparation denied. Approval, roster, source marks or grading policy may have changed.");
    } finally { setBusy(false); }
  }
  return <section className="school-card" aria-labelledby="report-source-heading">
    <h2 id="report-source-heading">Private source evidence</h2>
    <p>Only an active School Super Admin can freeze source evidence for a
      separately approved result-sheet version. Student details remain
      server-private. This is not a computed grade, official report,
      student/guardian release, export or download.</p>
    <form onSubmit={freeze}>
      <label htmlFor="source-final-decision">Final approval decision</label>
      <select id="source-final-decision" value={finalDecisionId} required
        onChange={e => setFinalDecisionId(e.target.value)}>
        <option value="">Choose an independently approved source</option>
        {eligible.map(d => <option key={d.id} value={d.id}>
          {d.className} / {d.subjectName} — revision {d.evidenceRevision},
          owner approval {d.ordinal}
        </option>)}
      </select>
      <label htmlFor="source-reason">Preparation reason (audit)</label>
      <textarea id="source-reason" required minLength={5} maxLength={500}
        value={reason} onChange={e => setReason(e.target.value)} />
      <button type="submit" disabled={busy || !finalDecisionId || reason.trim().length < 5}>
        Freeze private source (do not publish)
      </button>
    </form>
    <h3>Private packet history</h3>
    <ul>{packets.map(p => <li key={p.id}>
      Evidence version {p.evidenceRevision}, final decision {p.finalDecisionOrdinal},
      {p.studentCount} enrolled pupil sources frozen. Not graded or released.
    </li>)}</ul>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
