"use client";
import { useState } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
interface Component {
  componentId: string;
  title: string;
  kind: string;
  maxPoints: number;
  originalPoints: number | null;
  effectiveApprovedPoints: number | null;
  approvedCorrectionRevision: number | null;
  latestCorrectionRevision: number | null;
  status: string;
}
interface Pupil {
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  components: Component[];
  approvedMarksSum: number;
  totalPossiblePoints: number;
  unapprovedComponents: number;
  pendingCorrections: number;
  completedPercentBps: number | null;
  readyForFurtherAcademicReview: boolean;
}
export function AssessmentReviewedManualGradebookWorkspace({
  schoolId,
  options,
}: {
  schoolId: string;
  options: LessonWritingOptions;
}) {
  const [assignmentId, setAssignmentId] = useState("");
  const [termId, setTermId] = useState("");
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const assignment = options.assignments.find((a) => a.id === assignmentId);
  async function load() {
    if (!assignment || !termId || busy) return;
    setBusy(true);
    setMessage("");
    setPupils([]);
    try {
      const q = new URLSearchParams({
        classId: assignment.classId,
        sessionId: assignment.sessionId,
        termId,
        subjectId: assignment.subjectId,
      });
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-reviewed-manual-gradebook?${q}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!response.ok) throw Error();
      const data = (await response.json()) as {
        gradebook: {
          students: Pupil[];
          status: string;
        };
      };
      setPupils(data.gradebook.students);
      setMessage(
        "Private academic-approved preview loaded. This is not an official result or report card.",
      );
    } catch {
      setMessage("Approved manual gradebook unavailable or access changed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="manual-gradebook-heading">
      <h2 id="manual-gradebook-heading">
        Approved manual marks — private academic preview
      </h2>
      <p>
        Only your exact current class and subject. Pending teacher marks,
        unreviewed proposals and returned marks never contribute to approved
        totals. A pending correction blocks completion but preserves earlier
        approved marks. No student/parent visibility, export, or official result
        publication.
      </p>
      <label htmlFor="approved-manual-assignment">
        Current class/subject assignment
      </label>
      <select
        id="approved-manual-assignment"
        value={assignmentId}
        onChange={(e) => {
          setAssignmentId(e.target.value);
          setTermId("");
          setPupils([]);
        }}
      >
        <option value="">Choose assignment</option>
        {options.assignments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      <label htmlFor="approved-manual-term">Active academic term</label>
      <select
        id="approved-manual-term"
        value={termId}
        onChange={(e) => {
          setTermId(e.target.value);
          setPupils([]);
        }}
      >
        <option value="">Choose term</option>
        {options.terms
          .filter((t) => t.sessionId === assignment?.sessionId)
          .map((t) => (
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
        Load approved-only preview
      </button>
      {pupils.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>
              Confidential teacher-only manual academic review; not an official
              report card
            </caption>
            <thead>
              <tr>
                <th scope="col">Admission number</th>
                <th scope="col">Pupil</th>
                <th scope="col">Approved marks (partial)</th>
                <th scope="col">Completion</th>
                <th scope="col">Academic-reviewed preview</th>
              </tr>
            </thead>
            <tbody>
              {pupils.map((s) => (
                <tr key={s.studentId}>
                  <th scope="row">{s.admissionNumber}</th>
                  <td>
                    {s.givenName} {s.familyName}
                  </td>
                  <td>
                    {s.approvedMarksSum} / {s.totalPossiblePoints}
                  </td>
                  <td>
                    {s.unapprovedComponents} unapproved; {s.pendingCorrections}{" "}
                    pending corrections
                  </td>
                  <td>
                    {s.completedPercentBps === null
                      ? "INCOMPLETE"
                      : `${(s.completedPercentBps / 100).toFixed(2)}% (academic preview only)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pupils.map((student) => (
            <section
              key={student.studentId}
              aria-label={`Review details for ${student.admissionNumber}`}
            >
              <h3>{student.admissionNumber} — reviewed components</h3>
              <ul>
                {student.components.map((c) => (
                  <li key={c.componentId}>
                    {c.kind}: {c.title} —
                    {c.effectiveApprovedPoints === null
                      ? "NOT APPROVED"
                      : `${c.effectiveApprovedPoints}/${c.maxPoints}`}{" "}
                    — {c.status.replaceAll("_", " ")}
                    {c.approvedCorrectionRevision !== null &&
                      ` (approved revision ${c.approvedCorrectionRevision})`}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
