"use client";

import { useEffect, useState } from "react";
type Mark = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
const marks: Mark[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
interface RegisterOption {
  id: string;
  className: string;
  sessionName: string;
  attendanceDate: string;
}
interface Entry {
  entryId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  originalMark: Mark;
  effectiveMark: Mark;
  pending: boolean;
}
interface RegisterDetail extends RegisterOption {
  entries: Entry[];
}

export function AttendanceCorrectionEditor({ schoolId }: { schoolId: string }) {
  const [registers, setRegisters] = useState<RegisterOption[]>([]);
  const [detail, setDetail] = useState<RegisterDetail | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [proposed, setProposed] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const selected = detail?.entries.find(
    (entry) => entry.entryId === selectedEntryId,
  );

  useEffect(() => {
    let live = true;
    fetch(
      `/api/schools/${encodeURIComponent(schoolId)}/attendance/corrections`,
      { cache: "no-store", credentials: "same-origin" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then((data) => {
        if (live) {
          setRegisters(data.registers as RegisterOption[]);
          setDetail(null);
        }
      })
      .catch(() => {
        if (live) {
          setRegisters([]);
          setDetail(null);
          setMessage("Correction registers unavailable or access denied.");
        }
      });
    return () => {
      live = false;
    };
  }, [schoolId, reload]);

  async function load(id: string) {
    if (!id || working) return;
    setWorking(true);
    setMessage("");
    setDetail(null);
    setSelectedEntryId("");
    setProposed("");
    setReason("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance/${encodeURIComponent(id)}/corrections/entries`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) throw new Error("Unavailable");
      setDetail((await response.json()).register as RegisterDetail);
    } catch {
      setMessage(
        "Register unavailable or current Form Teacher access revoked.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !detail ||
      !selected ||
      selected.pending ||
      !proposed ||
      proposed === selected.effectiveMark ||
      reason.trim().length < 5 ||
      working
    )
      return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance/${encodeURIComponent(detail.id)}/corrections`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryId: selected.entryId,
            expectedMark: selected.effectiveMark,
            proposedMark: proposed,
            reason,
          }),
        },
      );
      if (!response.ok) {
        setMessage(
          response.status === 409
            ? "The mark changed or a correction is already pending. Reload the approved register."
            : "Correction request denied or unavailable.",
        );
        return;
      }
      setMessage(
        "Correction sent for independent section review. The original mark is preserved.",
      );
      setSelectedEntryId("");
      setProposed("");
      setReason("");
      setDetail(null);
      setReload((n) => n + 1);
    } catch {
      setMessage("Unable to submit correction request.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="school-card" aria-labelledby="correction-heading">
      <h2 id="correction-heading">Approved attendance registers</h2>
      <button
        type="button"
        disabled={working}
        onClick={() => setReload((n) => n + 1)}
      >
        Refresh authorized registers
      </button>
      <ul>
        {registers.map((item) => (
          <li key={item.id}>
            {item.sessionName} — {item.className}, {item.attendanceDate}{" "}
            <button
              type="button"
              disabled={working}
              onClick={() => load(item.id)}
            >
              View original marks
            </button>
          </li>
        ))}
      </ul>
      {registers.length === 0 && (
        <p>No approved class registers are available.</p>
      )}
      {detail && (
        <form onSubmit={submit}>
          <h3>
            {detail.className} · {detail.attendanceDate}
          </h3>
          <label htmlFor="correction-entry">Student and recorded mark</label>
          <select
            id="correction-entry"
            required
            value={selectedEntryId}
            onChange={(event) => {
              setSelectedEntryId(event.target.value);
              setProposed("");
            }}
          >
            <option value="">Select one pupil entry</option>
            {detail.entries.map((item) => (
              <option
                key={item.entryId}
                value={item.entryId}
                disabled={item.pending}
              >
                {item.admissionNumber} — {item.givenName} {item.familyName}
                {" · Original: "}
                {item.originalMark}
                {" · Effective: "}
                {item.effectiveMark}
                {item.pending ? " (pending review)" : ""}
              </option>
            ))}
          </select>
          {selected && (
            <>
              <p>
                Original mark: <strong>{selected.originalMark}</strong>. Current
                effective mark: <strong>{selected.effectiveMark}</strong>.
              </p>
              <label htmlFor="correction-proposed">
                Proposed corrected mark
              </label>
              <select
                id="correction-proposed"
                required
                value={proposed}
                onChange={(event) => setProposed(event.target.value)}
              >
                <option value="">Select a different mark</option>
                {marks
                  .filter((mark) => mark !== selected.effectiveMark)
                  .map((mark) => (
                    <option key={mark} value={mark}>
                      {mark}
                    </option>
                  ))}
              </select>
              <label htmlFor="correction-reason">
                Explain the correction (5–500 characters)
              </label>
              <textarea
                id="correction-reason"
                required
                minLength={5}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <button
                type="submit"
                disabled={
                  working ||
                  selected.pending ||
                  proposed === "" ||
                  proposed === selected.effectiveMark ||
                  reason.trim().length < 5
                }
              >
                Request independent correction review
              </button>
            </>
          )}
        </form>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
