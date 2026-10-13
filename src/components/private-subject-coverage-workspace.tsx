"use client";

import { useState, type FormEvent } from "react";
import type {
  PrivateSubjectCoverage,
} from "@/src/modules/results/private-subject-coverage-service";

type CoverageResponse = {
  status: "PRIVATE_SUBJECT_COVERAGE_METADATA_NOT_PUBLICATION";
  configuredSubjectCount: number;
  subjects: PrivateSubjectCoverage[];
};

const descriptions: Record<PrivateSubjectCoverage["state"], string> = {
  MISSING_TEACHER_RESULT_EVIDENCE: "Teacher result evidence not prepared",
  AWAITING_ACADEMIC_REVIEW: "Independent academic approval not recorded",
  AWAITING_OWNER_DECISION: "Final internal owner decision not recorded",
  AWAITING_PRIVATE_COMPOSITION: "Private official-grade composition not created",
  PRIVATE_COMPOSITION_POLICY_SUPERSEDED: "Composition uses superseded school grading policy",
  PRIVATE_COMPOSITION_METADATA_PRESENT_NOT_RELEASED: "Private composition exists; current checks still required",
};

export function PrivateSubjectCoverageWorkspace({ schoolId }: { schoolId: string }) {
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !sessionId.trim() || !termId.trim() || !classId.trim()) return;
    setBusy(true);
    setCoverage(null);
    setMessage("");
    try {
      const query = new URLSearchParams({
        sessionId: sessionId.trim(), termId: termId.trim(), classId: classId.trim(),
      });
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/private-subject-coverage?${query}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) throw new Error("Subject coverage unavailable");
      const data = (await response.json()) as CoverageResponse;
      if (data.status !== "PRIVATE_SUBJECT_COVERAGE_METADATA_NOT_PUBLICATION") {
        throw new Error("Unexpected status");
      }
      setCoverage(data);
    } catch {
      setMessage("Unable to verify the selected school/class/term scope.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="school-card" aria-labelledby="subject-coverage-heading">
      <h2 id="subject-coverage-heading">Current private subject-evidence coverage</h2>
      <p>
        School Super Admin only. This diagnostic lists subjects from ACTIVE,
        exactly session-scoped teacher assignments. It is not a complete
        school-adopted curriculum inventory: unassigned subjects and
        session-unspecified assignments are not counted.
      </p>
      <p>
        A displayed composition is NOT proof that the academic approval,
        roster or teacher authority remains current. This view does not
        publish grades, produce report cards, compute an overall average
        or grant student/guardian access. Parent-first acknowledgment
        decision P-004 remains unresolved.
      </p>
      <form onSubmit={inspect}>
        <label htmlFor="coverage-session">Exact academic session ID</label>
        <input id="coverage-session" maxLength={128} required value={sessionId}
          onChange={(e) => { setSessionId(e.target.value); setCoverage(null); }} />
        <label htmlFor="coverage-term">Exact term ID</label>
        <input id="coverage-term" maxLength={128} required value={termId}
          onChange={(e) => { setTermId(e.target.value); setCoverage(null); }} />
        <label htmlFor="coverage-class">Exact class ID</label>
        <input id="coverage-class" maxLength={128} required value={classId}
          onChange={(e) => { setClassId(e.target.value); setCoverage(null); }} />
        <button type="submit" disabled={busy || !sessionId.trim() || !termId.trim() || !classId.trim()}>
          Inspect current private subject evidence (not release)
        </button>
      </form>
      <p role="status" aria-live="polite">{message}</p>
      {coverage && (
        <div>
          <p>{coverage.configuredSubjectCount} subjects with active exact-session teaching assignments.</p>
          {coverage.subjects.length === 0
            ? <p>No exact-session active assignments found. This is NOT proof of curriculum completion.</p>
            : (
              <table>
                <caption>Private class-term subject evidence, not publication readiness</caption>
                <thead><tr><th scope="col">Subject</th><th scope="col">State</th><th scope="col">Evidence revision</th><th scope="col">Evidence pupil count</th></tr></thead>
                <tbody>{coverage.subjects.map((subject) => (
                  <tr key={subject.subjectId}>
                    <th scope="row">{subject.subjectName}</th>
                    <td>{descriptions[subject.state]}</td>
                    <td>{subject.evidenceRevision ?? "—"}</td>
                    <td>{subject.pupilCount ?? "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          <p><strong>PRIVATE DIAGNOSTIC ONLY — NOT A REPORT-CARD RELEASE.</strong></p>
        </div>
      )}
    </section>
  );
}
