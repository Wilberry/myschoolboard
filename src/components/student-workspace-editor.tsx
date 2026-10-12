"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StudentWorkspaceSnapshot } from "@/src/modules/students/read-workspace";

type Action = "register" | "enroll" | "withdraw";
export function StudentWorkspaceEditor({
  schoolId, snapshot,
}: { schoolId: string; snapshot: StudentWorkspaceSnapshot }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<Action>("register");
  const [studentId, setStudentId] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [reason, setReason] = useState("");
  const selected = snapshot.students.find(item => item.id === studentId);
  const activeEnrollments = selected?.enrollments.filter(item => item.status === "ACTIVE") ?? [];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const base = `/api/schools/${encodeURIComponent(schoolId)}/students`;
      const path = action === "register" ? base
        : action === "enroll" ? `${base}/${encodeURIComponent(studentId)}/enrollments`
        : `${base}/${encodeURIComponent(studentId)}/enrollments/${encodeURIComponent(enrollmentId)}/withdraw`;
      const body = action === "register"
        ? { admissionNumber, givenName, familyName, reason }
        : action === "enroll" ? { sessionId, classId, reason } : { reason };
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setMessage(response.status === 404 ? "Record unavailable or access denied."
          : response.status === 409 ? "Conflicting record or enrollment."
          : "Request failed. Check the fields or try again.");
        return;
      }
      setMessage("Recorded successfully.");
      setReason("");
      router.refresh();
    } catch {
      setMessage("Request failed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form onSubmit={submit} className="school-card">
        <h2>Manage student</h2>
        <label htmlFor="student-action">Action</label>
        <select id="student-action" value={action} onChange={event => setAction(event.target.value as Action)}>
          <option value="register">Register student</option>
          <option value="enroll">Enroll registered student</option>
          <option value="withdraw">Withdraw active enrollment</option>
        </select>
        {action === "register" ? (
          <>
            <label htmlFor="admission-no">Admission number</label>
            <input id="admission-no" required maxLength={40} value={admissionNumber} onChange={event => setAdmissionNumber(event.target.value)} />
            <label htmlFor="given-name">Given name</label>
            <input id="given-name" required maxLength={100} value={givenName} onChange={event => setGivenName(event.target.value)} />
            <label htmlFor="family-name">Family name</label>
            <input id="family-name" required maxLength={100} value={familyName} onChange={event => setFamilyName(event.target.value)} />
          </>
        ) : (
          <>
            <label htmlFor="student-select">Student</label>
            <select id="student-select" required value={studentId} onChange={event => { setStudentId(event.target.value); setEnrollmentId(""); }}>
              <option value="">Select student</option>
              {snapshot.students.filter(item => action === "enroll" ? item.status === "REGISTERED" : item.status === "ENROLLED").map(item => (
                <option key={item.id} value={item.id}>{item.admissionNumber} — {item.givenName} {item.familyName}</option>
              ))}
            </select>
            {action === "enroll" ? (
              <>
                <label htmlFor="session-select">Active session</label>
                <select id="session-select" required value={sessionId} onChange={event => setSessionId(event.target.value)}>
                  <option value="">Select session</option>
                  {snapshot.sessions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <label htmlFor="class-select">Active classified class</label>
                <select id="class-select" required value={classId} onChange={event => setClassId(event.target.value)}>
                  <option value="">Select class</option>
                  {snapshot.classes.map(item => <option key={item.id} value={item.id}>{item.sectionName} — {item.name}</option>)}
                </select>
              </>
            ) : (
              <>
                <label htmlFor="enrollment-select">Active enrollment</label>
                <select id="enrollment-select" required value={enrollmentId} onChange={event => setEnrollmentId(event.target.value)}>
                  <option value="">Select enrollment</option>
                  {activeEnrollments.map(item => <option key={item.id} value={item.id}>{snapshot.sessions.find(s => s.id === item.sessionId)?.name ?? item.sessionId} / {snapshot.classes.find(c => c.id === item.classId)?.name ?? item.classId}</option>)}
                </select>
              </>
            )}
          </>
        )}
        <label htmlFor="student-reason">Reason (5–500 characters)</label>
        <textarea id="student-reason" required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} />
        <button type="submit" disabled={busy}>{busy ? "Saving…" : "Record action"}</button>
        <p role="status" aria-live="polite">{message}</p>
      </form>
      <section aria-labelledby="student-list-heading">
        <h2 id="student-list-heading">Student register (first 50)</h2>
        <ul>
          {snapshot.students.map(item => (
            <li key={item.id}>
              <strong>{item.admissionNumber}</strong> — {item.givenName} {item.familyName} ({item.status})
              <ul>{item.enrollments.map(e => (
                <li key={e.id}>Enrollment: {snapshot.classes.find(c => c.id === e.classId)?.name ?? "Historical class"} / {snapshot.sessions.find(s => s.id === e.sessionId)?.name ?? "Historical session"} — {e.status}</li>
              ))}</ul>
            </li>
          ))}
        </ul>
        {snapshot.students.length === 0 && <p>No students registered.</p>}
      </section>
    </>
  );
}
