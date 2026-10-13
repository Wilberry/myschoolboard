"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { OwnerGradePreview } from "@/src/modules/results/private-owner-grade-preview-service";

type Composition = { id: string; evidenceRevision: number; studentCount: number };
type PreviewResponse = {
  preview: OwnerGradePreview;
  audit: { id: string; evidenceRevision: number; status: string };
};

export function PrivateGradePreviewWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [compositionId, setCompositionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${root}/private-official-report-compositions`, {
      credentials: "same-origin", cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("School compositions unavailable");
        return response.json();
      })
      .then((data: { compositions: Composition[] }) => {
        if (active) setCompositions(data.compositions);
      })
      .catch(() => {
        if (!active) return;
        setCompositions([]);
        setMessage("Private school compositions unavailable.");
      });
    return () => { active = false; };
  }, [root]);

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !compositionId || !studentId.trim() || reason.trim().length < 5) return;
    setBusy(true);
    setPreview(null);
    setMessage("");
    try {
      const response = await fetch(`${root}/private-owner-grade-previews`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compositionId, studentId: studentId.trim(), reason,
        }),
      });
      if (!response.ok) throw new Error("Preview was not authorized");
      const result = (await response.json()) as PreviewResponse;
      if (result.preview.status !== "PRIVATE_OWNER_PREVIEW_NOT_RELEASED") {
        throw new Error("Unexpected preview status");
      }
      setPreview(result);
      setMessage("Private one-pupil review was recorded in the audit history.");
    } catch {
      setMessage("Preview denied. Check the current school, academic approvals, grading policy and pupil enrollment.");
    } finally { setBusy(false); }
  }

  const card = preview?.preview;
  return (
    <section className="school-card" aria-labelledby="owner-grade-preview-heading">
      <h2 id="owner-grade-preview-heading">Private official-grade evidence preview</h2>
      <p>
        School Super Admin only. This is a confidential one-pupil preview,
        NOT a released report card. No student or guardian account can read it.
        Parent-first acknowledgment (P-004) remains unresolved. Every preview
        is recorded in an immutable audit log.
      </p>
      <form onSubmit={inspect}>
        <label htmlFor="owner-preview-composition">Private approved composition</label>
        <select id="owner-preview-composition" required value={compositionId}
          onChange={(event) => { setCompositionId(event.target.value); setPreview(null); }}>
          <option value="">Select a private composition</option>
          {compositions.map((c) => (
            <option key={c.id} value={c.id}>
              Evidence revision {c.evidenceRevision}, {c.studentCount} pupils
            </option>
          ))}
        </select>
        <label htmlFor="owner-preview-pupil">Exact pupil record ID</label>
        <input id="owner-preview-pupil" required maxLength={128} value={studentId}
          onChange={(event) => { setStudentId(event.target.value); setPreview(null); }} />
        <label htmlFor="owner-preview-reason">Reason for private grade inspection</label>
        <textarea id="owner-preview-reason" required minLength={5} maxLength={500}
          value={reason} onChange={(event) => setReason(event.target.value)} />
        <button type="submit" disabled={
          busy || !compositionId || !studentId.trim() || reason.trim().length < 5
        }>
          View one pupil&apos;s private grade (audited, never publish)
        </button>
      </form>
      <p role="status" aria-live="polite">{message}</p>
      {card && (
        <article aria-label="Confidential unreleased grade preview">
          <h3>PRIVATE PREVIEW — NOT RELEASED</h3>
          <p><strong>{card.schoolName}</strong></p>
          <p>
            Pupil: {card.student.givenName} {card.student.familyName}
            {" · "}Admission: {card.student.admissionNumber}
          </p>
          <p>
            {card.academic.session} · {card.academic.term} ·
            {" "}{card.academic.class} · {card.academic.subject}
          </p>
          <table>
            <caption>Approved category results — internal owner review only</caption>
            <thead><tr><th scope="col">Component</th><th scope="col">Weight</th><th scope="col">Category percent</th></tr></thead>
            <tbody>{(["QUIZ", "TEST", "EXAM"] as const).map((kind) => (
              <tr key={kind}>
                <th scope="row">{kind}</th>
                <td>{card.assessmentWeights[kind]}%</td>
                <td>{card.categoryPercentBps[kind] === null
                  ? "Not applicable"
                  : `${(card.categoryPercentBps[kind]! / 100).toFixed(2)}%`}
                </td>
              </tr>
            ))}</tbody>
          </table>
          <p>Computed total: {card.displayPercent}%</p>
          <p>Grade: {card.gradeCode} · {card.remark}</p>
          <p>
            Frozen evidence revision {card.evidenceRevision} ·
            grade policy v{card.gradeScaleVersion} ·
            aggregation v{card.aggregationRuleVersion}
          </p>
          <p><strong>CONFIDENTIAL. NOT AN OFFICIAL REPORT CARD. NOT RELEASED.</strong></p>
        </article>
      )}
    </section>
  );
}
