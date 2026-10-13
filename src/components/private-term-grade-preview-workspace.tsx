"use client";

import { useState, type FormEvent } from "react";
import type {
  OwnerPrivateTermPreview,
} from "@/src/modules/results/private-term-grade-preview-service";

export function PrivateTermGradePreviewWorkspace({
  schoolId,
}: { schoolId: string }) {
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<OwnerPrivateTermPreview | null>(null);
  const [message, setMessage] = useState("");

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy || !sessionId.trim() || !termId.trim() || !classId.trim() ||
      !studentId.trim() || reason.trim().length < 5
    ) return;
    setBusy(true);
    setPreview(null);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/private-term-grade-previews`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId.trim(), termId: termId.trim(),
            classId: classId.trim(), studentId: studentId.trim(), reason,
          }),
        },
      );
      if (!response.ok) throw new Error("Private preview denied");
      const data = (await response.json()) as OwnerPrivateTermPreview;
      if (
        data.status !== "PRIVATE_TERM_OWNER_PREVIEW_NOT_RELEASED" ||
        data.coverage !==
          "ACTIVE_SESSION_ASSIGNMENTS_ONLY_NOT_OFFICIAL_COMPLETENESS"
      ) throw new Error("Invalid private preview state");
      setPreview(data);
      setMessage(
        "Internal review only. Every included subject was audited. No reports were released.",
      );
    } catch {
      setMessage(
        "Term preview unavailable. An enrolled pupil, exact class/term, current subject assignment or approved grade may be missing or stale.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="school-card" aria-labelledby="private-term-preview-title">
      <h2 id="private-term-preview-title">
        Confidential multi-subject term inspection
      </h2>
      <p>
        School Super Admin only. Enter exact school records from the existing
        academic administration workspace. The selected pupil must be actively
        enrolled, and each currently assigned subject must have current,
        independently approved frozen grades. A missing or stale subject
        blocks the entire preview; no partial results are shown.
      </p>
      <p>
        The subject list is based on current, active teacher assignments for
        the selected session, <strong>not a school-adopted curriculum</strong>.
        This is not proof of official result completeness. No ranking, class
        position, download, QR, publication, student or guardian access is
        available. Parent-first acknowledgment (P-004) remains undecided.
      </p>
      <form onSubmit={inspect}>
        <label htmlFor="term-preview-session">Exact academic session ID</label>
        <input id="term-preview-session" value={sessionId} required maxLength={128}
          onChange={(e) => { setSessionId(e.target.value); setPreview(null); }} />
        <label htmlFor="term-preview-term">Exact term ID</label>
        <input id="term-preview-term" value={termId} required maxLength={128}
          onChange={(e) => { setTermId(e.target.value); setPreview(null); }} />
        <label htmlFor="term-preview-class">Exact class ID</label>
        <input id="term-preview-class" value={classId} required maxLength={128}
          onChange={(e) => { setClassId(e.target.value); setPreview(null); }} />
        <label htmlFor="term-preview-student">Exact pupil record ID</label>
        <input id="term-preview-student" value={studentId} required maxLength={128}
          onChange={(e) => { setStudentId(e.target.value); setPreview(null); }} />
        <label htmlFor="term-preview-reason">Reason for confidential review</label>
        <textarea id="term-preview-reason" value={reason} required
          minLength={5} maxLength={500}
          onChange={(e) => { setReason(e.target.value); setPreview(null); }} />
        <button type="submit" disabled={
          busy || !sessionId.trim() || !termId.trim() || !classId.trim() ||
          !studentId.trim() || reason.trim().length < 5
        }>
          Inspect all assigned term subjects (audited; never publish)
        </button>
      </form>
      <p role="status" aria-live="polite">{message}</p>
      {preview && (
        <article aria-label="Confidential unreleased term preview">
          <h3>PRIVATE TERM PREVIEW — NOT RELEASED</h3>
          <p><strong>{preview.schoolName}</strong></p>
          <p>
            Pupil: {preview.student.givenName} {preview.student.familyName}
            {" · "}Admission: {preview.student.admissionNumber}
          </p>
          <p>
            {preview.academic.session} · {preview.academic.term}
            {" · "}{preview.academic.class}
          </p>
          <p>
            Scope: {preview.subjectCount} currently assigned subject(s),
            each separately audited. No official curriculum-completeness,
            average, rank or promotion decision is calculated.
          </p>
          <table>
            <caption>Confidential per-subject approved grade evidence</caption>
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Percent</th>
                <th scope="col">Grade</th>
                <th scope="col">Remark</th>
              </tr>
            </thead>
            <tbody>
              {preview.subjects.map((subject) => (
                <tr key={subject.subject}>
                  <th scope="row">{subject.subject}</th>
                  <td>{subject.displayPercent}%</td>
                  <td>{subject.gradeCode}</td>
                  <td>{subject.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <strong>
              CONFIDENTIAL. NOT AN OFFICIAL REPORT CARD. NOT RELEASED.
            </strong>
          </p>
        </article>
      )}
    </section>
  );
}
