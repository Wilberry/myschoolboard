"use client";

import { useEffect, useState, type FormEvent } from "react";

type Candidate = {
  evidenceId: string; className: string; subjectName: string;
  termId: string; revision: number; studentCount: number;
};
type Decision = {
  id: string; evidenceId: string; className: string; subjectName: string;
  ordinal: number; evidenceRevision: number;
  status: string; reason: string;
};
export function FinalResultApprovalWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [evidenceId, setEvidenceId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    Promise.all([
      fetch(`${root}/result-publication-candidates`, { cache: "no-store" }),
      fetch(`${root}/result-final-publication-decisions`, { cache: "no-store" }),
    ]).then(async ([eligible, history]) => {
      if (!eligible.ok || !history.ok) throw new Error();
      return Promise.all([eligible.json(), history.json()]);
    }).then(([eligible, history]) => {
      if (!current) return;
      setCandidates(eligible.candidates);
      setDecisions(history.decisions);
    }).catch(() => {
      if (current) {
        setCandidates([]); setDecisions([]);
        setMessage("Unable to verify current academic evidence. No decision recorded.");
      }
    });
    return () => { current = false; };
  }, [root, refresh]);

  const eligible = candidates.filter(candidate =>
    !decisions.some(decision => decision.evidenceId === candidate.evidenceId));
  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !evidenceId || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${root}/result-final-publication-decisions`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId, reason }),
      });
      if (!response.ok) throw new Error();
      setMessage("Final School Super Admin approval recorded. Student and guardian release remains disabled.");
      setEvidenceId(""); setReason(""); setRefresh(n => n + 1);
    } catch {
      setMessage("Approval rejected. Academic evidence, grading policy or permissions may have changed.");
    } finally { setBusy(false); }
  }

  return <section className="school-card" aria-labelledby="final-result-owner-heading">
    <h2 id="final-result-owner-heading">Record final school approval</h2>
    <p>School Super Admin only. This action appends an immutable, independently
      validated decision for one already reviewed result-sheet revision.
      <strong> It does not publish report cards or disclose student results.</strong></p>
    <form onSubmit={approve}>
      <label htmlFor="final-result-evidence">Currently approved academic evidence</label>
      <select id="final-result-evidence" value={evidenceId} required
        onChange={event => setEvidenceId(event.target.value)}>
        <option value="">Choose an eligible result sheet</option>
        {eligible.map(item => <option key={item.evidenceId} value={item.evidenceId}>
          {item.className} / {item.subjectName} / {item.termId} —
          revision {item.revision}, {item.studentCount} pupils
        </option>)}
      </select>
      <label htmlFor="final-result-reason">Reason for final school approval</label>
      <textarea id="final-result-reason" value={reason} required
        minLength={5} maxLength={500}
        onChange={event => setReason(event.target.value)} />
      <button type="submit" disabled={busy || !evidenceId || reason.trim().length < 5}>
        Record final approval (do not release)
      </button>
    </form>
    <h3>Immutable decision audit history</h3>
    <ul>{decisions.map(decision => <li key={decision.id}>
      {decision.className} / {decision.subjectName}:
      approval {decision.ordinal}, evidence revision {decision.evidenceRevision},
      {decision.status} — {decision.reason}
    </li>)}</ul>
    <p role="status" aria-live="polite">{message}</p>
    <p>Official result calculation, release, downloads and student/guardian visibility
      are not implemented in this development milestone.</p>
  </section>;
}
