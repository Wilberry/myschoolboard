"use client";
import { useState } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
interface ScoreRow {
  draftId: string; title: string; kind: string;
  possiblePoints: number; earnedPoints: number | null;
  percentBps: number | null; passed: boolean | null; attemptNumber: number | null;
}
interface StudentRow {
  studentId: string; admissionNumber: string; givenName: string; familyName: string;
  assessments: ScoreRow[]; assessedPoints: number; possiblePoints: number;
  pendingAssessments: number; percentBps: number | null;
}
export function AssessmentClassRecordWorkspace({
  schoolId, options,
}: { schoolId: string; options: LessonWritingOptions }) {
  const [assignmentId, setAssignmentId] = useState("");
  const [termId, setTermId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const assignment = options.assignments.find(a => a.id === assignmentId);
  const terms = options.terms.filter(t => t.sessionId === assignment?.sessionId);
  async function load() {
    if (!assignment || !termId || loading) return;
    setLoading(true); setStatus(""); setStudents([]);
    try {
      const query = new URLSearchParams({
        classId: assignment.classId, sessionId: assignment.sessionId,
        subjectId: assignment.subjectId, termId,
      });
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-class-records?${query}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!response.ok) throw Error();
      const body = await response.json() as { sheet: { students: StudentRow[] } };
      setStudents(body.sheet.students);
      setStatus("Provisional records loaded. These are not approved report-card grades.");
    } catch { setStatus("Record sheet unavailable or access has changed."); }
    finally { setLoading(false); }
  }
  return <section className="school-card" aria-labelledby="class-record-title">
    <h2 id="class-record-title">Private class record sheet (provisional)</h2>
    <p>Only your current assigned class, subject, session and term. Objective marks come from immutable teacher-initiated scoring; unanswered, unscored or withdrawn assessments are never treated as official results. No publication or download is available.</p>
    <label htmlFor="record-assignment">Class and subject</label>
    <select id="record-assignment" value={assignmentId}
      onChange={e => { setAssignmentId(e.target.value); setTermId(""); setStudents([]); }}>
      <option value="">Choose my assignment</option>
      {options.assignments.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
    </select>
    <label htmlFor="record-term">Academic term</label>
    <select id="record-term" value={termId}
      onChange={e => { setTermId(e.target.value); setStudents([]); }}>
      <option value="">Choose active term</option>
      {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
    <button type="button" disabled={!assignment || !termId || loading}
      onClick={() => { void load(); }}>Load provisional class record</button>
    {students.length > 0 && <div style={{ overflowX: "auto" }}>
      <table>
        <caption>Confidential teacher-only provisional scores; best scored submitted attempt per published assessment</caption>
        <thead><tr><th scope="col">Admission number</th><th scope="col">Student</th>
          <th scope="col">Marks (scored assessments)</th>
          <th scope="col">Percentage</th><th scope="col">Pending</th></tr></thead>
        <tbody>{students.map(student => <tr key={student.studentId}>
          <th scope="row">{student.admissionNumber}</th>
          <td>{student.givenName} {student.familyName}</td>
          <td>{student.possiblePoints > 0
            ? `${student.assessedPoints} / ${student.possiblePoints}`
            : "No scored assessments"}</td>
          <td>{student.percentBps === null
            ? "Pending" : `${(student.percentBps / 100).toFixed(2)}%`}</td>
          <td>{student.pendingAssessments}</td>
        </tr>)}</tbody>
      </table>
      <h3>Per-assessment marks</h3>
      {students.map(student => <section key={student.studentId}
        aria-label={`Scores for ${student.admissionNumber}`}>
        <h4>{student.admissionNumber}</h4>
        <ul>{student.assessments.map(a => <li key={a.draftId}>
          {a.kind}: {a.title} — {a.earnedPoints === null ? "Pending score"
            : `${a.earnedPoints} / ${a.possiblePoints}`}
        </li>)}</ul>
      </section>)}
    </div>}
    <p role="status" aria-live="polite">{status}</p>
  </section>;
}
