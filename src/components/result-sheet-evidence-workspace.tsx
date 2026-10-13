"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
interface Snapshot { id: string; revision: number; studentCount: number;
 classId: string; subjectId: string; reason: string; reviewAction: string|null; }
export function ResultSheetEvidenceWorkspace({
  schoolId, options,
}: { schoolId: string; options: LessonWritingOptions }) {
  const [assignmentId, setAssignmentId] = useState("");
  const [termId, setTermId] = useState("");
  const [reason, setReason] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const assignment = options.assignments.find(a => a.id === assignmentId);
  const url = `/api/schools/${encodeURIComponent(schoolId)}/result-sheet-evidence`;
  useEffect(() => {
    let live = true;
    fetch(url, { cache: "no-store", credentials: "same-origin" })
      .then(async r => { if (!r.ok) throw Error(); return r.json(); })
      .then(r => { if (live) setSnapshots(r.snapshots); })
      .catch(() => { if (live) setMessage("Current teacher evidence history unavailable."); });
    return () => { live = false; };
  }, [url, refresh]);
  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !assignment || !termId || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch(url, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, termId, reason }),
      });
      if (!r.ok) throw Error();
      setMessage("Immutable source evidence prepared for independent academic review. No result published.");
      setReason(""); setRefresh(x => x + 1);
    } catch {
      setMessage("Preparation denied: policy not adopted, missing approved marks, or a prior sheet is not returned.");
    } finally { setBusy(false); }
  }
  return <section className="school-card" aria-labelledby="evidence-title">
    <h2 id="evidence-title">Freeze result-sheet evidence</h2>
    <p>Requires an explicitly adopted school grading profile and complete reviewed marks for each enrolled pupil. The database, not the browser, freezes underlying marks and source IDs. Approval is independent; publication remains disabled.</p>
    <form onSubmit={prepare}>
      <label htmlFor="evidence-assignment">Current assigned class and subject</label>
      <select id="evidence-assignment" value={assignmentId} required
        onChange={e => { setAssignmentId(e.target.value); setTermId(""); }}>
        <option value="">Choose assignment</option>
        {options.assignments.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
      <label htmlFor="evidence-term">Active academic term</label>
      <select id="evidence-term" required value={termId} onChange={e => setTermId(e.target.value)}>
        <option value="">Choose term</option>
        {options.terms.filter(t => t.sessionId === assignment?.sessionId).map(t =>
          <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <label htmlFor="evidence-reason">Preparation audit reason</label>
      <textarea id="evidence-reason" required minLength={5} maxLength={500}
        value={reason} onChange={e => setReason(e.target.value)} />
      <button type="submit" disabled={!assignment || !termId || busy || reason.trim().length < 5}>
        Freeze evidence for academic review
      </button>
    </form>
    <h3>My prepared result evidence</h3>
    <ul>{snapshots.map(s => <li key={s.id}>
      {s.classId} / {s.subjectId} — revision {s.revision},
      {s.studentCount} pupils — {s.reviewAction ?? "AWAITING REVIEW"}.
      <span> {s.reason}</span>
    </li>)}</ul>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
