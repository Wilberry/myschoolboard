"use client";
import { useEffect, useState } from "react";
interface Source { draftId?: string; componentId?: string; kind: string;
  earnedPoints?: number|null; effectivePoints?: number|null; maxPoints: number; }
interface Pupil { studentId: string; admissionNumber: string;
  givenName: string; familyName: string; cbt: Source[]; manual: Source[]; }
interface Candidate { id: string; className: string; subjectName: string;
  sectionName: string; termId: string; revision: number;
  studentCount: number; reason: string; sourceManifest: Pupil[]; }
export function ResultSheetReviewWorkspace({ schoolId }: { schoolId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reasons, setReasons] = useState<Record<string,string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  useEffect(() => {
    let live = true;
    fetch(`${root}/result-sheet-reviews`, { cache: "no-store", credentials: "same-origin" })
      .then(async r => { if (!r.ok) throw Error(); return r.json(); })
      .then(data => { if (live) setCandidates(data.candidates); })
      .catch(() => { if (live) setMessage("Current verified section review unavailable."); });
    return () => { live = false; };
  }, [root, refresh]);
  async function decide(evidenceId: string, action: "APPROVED"|"RETURNED") {
    if (busy) return;
    const reason = (reasons[evidenceId] ?? "").trim();
    if (reason.length < 5) { setMessage("Provide an audit reason of at least five characters."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await fetch(
        `${root}/result-sheet-reviews/${encodeURIComponent(evidenceId)}/decision`, {
          method: "POST", cache: "no-store", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        });
      if (!result.ok) throw Error();
      setMessage("Independent academic decision saved. Results are NOT published.");
      setRefresh(x => x + 1);
    } catch {
      setMessage("Review denied: incorrect section, stale marks or policy, or an earlier decision.");
    } finally { setBusy(false); }
  }
  return <section className="school-card" aria-labelledby="review-evidence-title">
    <h2 id="review-evidence-title">Academic review of frozen result evidence</h2>
    <p>Verified PRIMARY Head of Section or SECONDARY Principal only for this exact section. Review source marks before deciding; a changed or superseded source will be rejected. No School Super Admin publication action or student access is provided here.</p>
    <ul>{candidates.map(c => <li key={c.id}>
      <h3>{c.sectionName} / {c.className} / {c.subjectName}, revision {c.revision}</h3>
      <p>{c.studentCount} enrolled pupils. Teacher reason: {c.reason}</p>
      <div style={{ overflowX: "auto" }}><table>
        <caption>Private frozen source marks; not an official student report card</caption>
        <thead><tr><th scope="col">Pupil</th><th scope="col">Objective sources</th>
          <th scope="col">Independently reviewed manual sources</th></tr></thead>
        <tbody>{c.sourceManifest.map(p => <tr key={p.studentId}>
          <th scope="row">{p.admissionNumber}: {p.givenName} {p.familyName}</th>
          <td>{p.cbt.map(s => `${s.kind}: ${s.earnedPoints}/${s.maxPoints}`).join("; ") || "None"}</td>
          <td>{p.manual.map(s => `${s.kind}: ${s.effectivePoints}/${s.maxPoints}`).join("; ") || "None"}</td>
        </tr>)}</tbody>
      </table></div>
      <label htmlFor={`result-review-reason-${c.id}`}>Academic review reason</label>
      <textarea id={`result-review-reason-${c.id}`} minLength={5} maxLength={500}
        value={reasons[c.id] ?? ""} onChange={e => setReasons(v => ({ ...v, [c.id]: e.target.value }))} />
      <button type="button" disabled={busy} onClick={() => { void decide(c.id, "APPROVED"); }}>
        Approve source evidence (not publish)
      </button>
      <button type="button" disabled={busy} onClick={() => { void decide(c.id, "RETURNED"); }}>
        Return evidence for re-preparation
      </button>
    </li>)}</ul>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
