"use client";

import { useState } from "react";

interface ClassChoice {
  classId: string;
  className: string;
  sessionId: string;
  sessionName: string;
}
interface StudentChoice {
  enrollmentId: string;
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
}
interface Roster {
  classId: string;
  sessionId: string;
  className: string;
  sessionName: string;
  roster: StudentChoice[];
}

const allowedMarks = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export function AttendanceEntryEditor({
  schoolId, classes,
}: { schoolId: string; classes: ClassChoice[] }) {
  const [choice, setChoice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<Roster | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const selected = choice === "" ? null : classes[Number(choice)] ?? null;
  const complete = Boolean(roster && roster.roster.length > 0 &&
    roster.roster.every(person => allowedMarks.some(mark => mark === marks[person.enrollmentId])));

  async function loadRoster() {
    if (!selected || loading) return;
    setLoading(true);
    setMessage("");
    setRoster(null);
    setMarks({});
    try {
      const query = new URLSearchParams({
        classId: selected.classId, sessionId: selected.sessionId,
      });
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance/roster?${query.toString()}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) {
        setMessage("Roster unavailable or access denied.");
        return;
      }
      const data = (await response.json()).roster as Roster;
      setRoster(data);
      setMessage(data.roster.length === 0
        ? "No enrolled students. Attendance submission requires a nonempty roster."
        : "Select an attendance mark for every student; no mark is preselected.");
    } catch {
      setMessage("Unable to load roster.");
    } finally {
      setLoading(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !complete || !roster || loading ||
        roster.classId !== selected.classId || roster.sessionId !== selected.sessionId) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance`, {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId: selected.classId,
            sessionId: selected.sessionId,
            attendanceDate: date,
            marks: roster.roster.map(person => ({
              enrollmentId: person.enrollmentId,
              mark: marks[person.enrollmentId],
            })),
          }),
        },
      );
      if (!response.ok) {
        setMessage(response.status === 409
          ? "The roster changed or attendance for this date has already been submitted."
          : "Attendance could not be submitted. Recheck current class access.");
        return;
      }
      setMessage("Attendance submitted for section review. Existing marks are immutable.");
      setRoster(null);
      setMarks({});
    } catch {
      setMessage("Unable to submit attendance.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="attendance-entry-heading">
      <h2 id="attendance-entry-heading">Daily register</h2>
      <label htmlFor="attendance-class">Assigned class and session</label>
      <select id="attendance-class" value={choice} onChange={event => {
        setChoice(event.target.value); setRoster(null); setMarks({}); setMessage("");
      }}>
        <option value="">Select assigned class</option>
        {classes.map((item, index) => (
          <option key={`${item.classId}-${item.sessionId}`} value={String(index)}>
            {item.sessionName} — {item.className}
          </option>
        ))}
      </select>
      <button type="button" disabled={!selected || loading} onClick={loadRoster}>
        {loading ? "Working…" : "Load verified class roster"}
      </button>
      {roster && (
        <form onSubmit={submit}>
          <label htmlFor="attendance-date">Attendance date (UTC)</label>
          <input id="attendance-date" type="date" required max={new Date().toISOString().slice(0, 10)}
            value={date} onChange={event => setDate(event.target.value)} />
          <ul>
            {roster.roster.map(person => (
              <li key={person.enrollmentId}>
                <label htmlFor={`mark-${person.enrollmentId}`}>
                  {person.admissionNumber} — {person.givenName} {person.familyName}
                </label>
                <select
                  id={`mark-${person.enrollmentId}`}
                  required value={marks[person.enrollmentId] ?? ""}
                  onChange={event => setMarks(previous => ({
                    ...previous, [person.enrollmentId]: event.target.value,
                  }))}
                >
                  <option value="">Choose mark</option>
                  {allowedMarks.map(mark => <option key={mark} value={mark}>{mark}</option>)}
                </select>
              </li>
            ))}
          </ul>
          <button disabled={!complete || loading} type="submit">Submit complete register</button>
        </form>
      )}
      <p aria-live="polite" role="status">{message}</p>
    </section>
  );
}
