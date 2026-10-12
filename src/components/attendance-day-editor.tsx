"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface Day { attendanceDate: string; revision: number; isTeachingDay: boolean }
export function AttendanceDayEditor({ schoolId, recent }: { schoolId: string; recent: Day[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [teaching, setTeaching] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || reason.trim().length < 5) return;
    setPending(true); setNotice("");
    try {
      const result = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance-days`,
        { method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendanceDate: date, isTeachingDay: teaching, reason }),
        },
      );
      if (!result.ok) {
        setNotice(result.status === 409
          ? "This date already contains attendance or the calendar changed. Refresh the page."
          : "Calendar change rejected. Check the date, reason and administrator access.");
        return;
      }
      setNotice("Audited school day revision created."); setDate(""); setReason("");
      router.refresh();
    } catch {
      setNotice("Network error. No change confirmed.");
    } finally { setPending(false); }
  }
  return <section className="school-card" aria-labelledby="school-teaching-days">
    <h2 id="school-teaching-days">Teaching days and school closures</h2>
    <p>Dates are treated as teaching days unless explicitly designated otherwise. You cannot change a date after attendance has been recorded for it. National holidays and weekends are not assumed automatically.</p>
    <form onSubmit={submit}>
      <label htmlFor="teaching-date">School calendar date</label>
      <input id="teaching-date" type="date" required value={date}
        onChange={e => setDate(e.target.value)} />
      <label htmlFor="is-teaching-day">Designation</label>
      <select id="is-teaching-day" value={teaching ? "TEACHING" : "CLOSED"}
        onChange={e => setTeaching(e.target.value === "TEACHING")}>
        <option value="CLOSED">Non-teaching day / holiday</option>
        <option value="TEACHING">Teaching day / reopen designation</option>
      </select>
      <label htmlFor="school-day-reason">Reason (5–500 characters)</label>
      <textarea id="school-day-reason" required minLength={5} maxLength={500}
        value={reason} onChange={e => setReason(e.target.value)} />
      <button type="submit" disabled={pending || reason.trim().length < 5}>
        Save immutable date revision
      </button>
      <p role="status" aria-live="polite">{notice}</p>
    </form>
    <h3>Recent configured dates</h3>
    <ul>{recent.map(v => <li key={v.attendanceDate}>
      {v.attendanceDate}: {v.isTeachingDay ? "Teaching" : "Closed"} (revision {v.revision})
    </li>)}</ul>
  </section>;
}
