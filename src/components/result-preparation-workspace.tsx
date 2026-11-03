"use client";
import { useState } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";

interface PreparedPupil {
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  objectiveAssessments: number;
  unscoredObjectiveAssessments: number;
  manualComponents: number;
  unapprovedManualComponents: number;
  pendingManualCorrections: number;
  status: "NEEDS_SOURCE_WORK" | "SOURCES_RECONCILED_NOT_APPROVED";
  blockers: string[];
}
interface Readiness {
  status: "PRIVATE_PREPARATION_ONLY";
  gradingPolicyVersion: number | null;
  studentCount: number;
  blockedCount: number;
  students: PreparedPupil[];
}
const blockerNames: Record<string, string> = {
  NO_ASSESSMENT_SOURCE: "No assessment evidence recorded",
  OBJECTIVE_SCORING_PENDING: "Objective marking is incomplete",
  MANUAL_REVIEW_PENDING: "Written marks await independent academic approval",
  MANUAL_CORRECTION_PENDING: "A written-mark correction awaits review",
  GRADING_POLICY_NOT_ADOPTED:
    "A school grading profile has not been formally adopted",
};
export function ResultPreparationWorkspace({
  schoolId,
  options,
}: {
  schoolId: string;
  options: LessonWritingOptions;
}) {
  const [assignmentId, setAssignmentId] = useState("");
  const [termId, setTermId] = useState("");
  const [view, setView] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const assignment = options.assignments.find((a) => a.id === assignmentId);
  const terms = options.terms.filter(
    (t) => t.sessionId === assignment?.sessionId,
  );
  async function load() {
    if (!assignment || !termId || busy) return;
    setBusy(true);
    setView(null);
    setMessage("");
    const query = new URLSearchParams({
      classId: assignment.classId,
      sessionId: assignment.sessionId,
      termId,
      subjectId: assignment.subjectId,
    });
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/result-preparation?${query}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) throw Error();
      const result = (await response.json()) as { preparation: Readiness };
      setView(result.preparation);
      setMessage(
        "Private preflight loaded. No results were approved or published.",
      );
    } catch {
      setMessage(
        "Preparation unavailable. Assignment access or student enrollment may have changed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="result-prep-title">
      <h2 id="result-prep-title">Result-sheet preparation checklist</h2>
      <p>
        This is a confidential teacher-only preflight, not a result sheet,
        approved grade, report card or final publication. It checks source
        completeness without combining CBT and manual scores or exposing answer
        keys.
      </p>
      <label htmlFor="result-prep-assignment">
        Current assigned class and subject
      </label>
      <select
        id="result-prep-assignment"
        value={assignmentId}
        onChange={(e) => {
          setAssignmentId(e.target.value);
          setTermId("");
          setView(null);
        }}
      >
        <option value="">Choose assignment</option>
        {options.assignments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      <label htmlFor="result-prep-term">Active academic term</label>
      <select
        id="result-prep-term"
        value={termId}
        onChange={(e) => {
          setTermId(e.target.value);
          setView(null);
        }}
      >
        <option value="">Choose term</option>
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!assignment || !termId || busy}
        onClick={() => {
          void load();
        }}
      >
        Check result source readiness
      </button>
      {view && (
        <div>
          <p>
            <strong>{view.studentCount}</strong> enrolled students reviewed;
            <strong> {view.blockedCount}</strong> with incomplete source
            evidence. Grading profile revision:{" "}
            {view.gradingPolicyVersion ?? "Not configured"}. Even a configured
            revision is only a draft, not adopted for official results.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table>
              <caption>
                Private academic source reconciliation — not an official report
              </caption>
              <thead>
                <tr>
                  <th scope="col">Admission</th>
                  <th scope="col">Student</th>
                  <th scope="col">CBT evidence</th>
                  <th scope="col">Written evidence</th>
                  <th scope="col">Preparation blockers</th>
                </tr>
              </thead>
              <tbody>
                {view.students.map((s) => (
                  <tr key={s.studentId}>
                    <th scope="row">{s.admissionNumber}</th>
                    <td>
                      {s.givenName} {s.familyName}
                    </td>
                    <td>
                      {s.objectiveAssessments} assessments;{" "}
                      {s.unscoredObjectiveAssessments} unscored
                    </td>
                    <td>
                      {s.manualComponents} components;{" "}
                      {s.unapprovedManualComponents} unapproved;
                      {s.pendingManualCorrections} pending corrections
                    </td>
                    <td>
                      <ul>
                        {s.blockers.map((code) => (
                          <li key={code}>
                            {blockerNames[code] ??
                              "Academic policy review required"}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
