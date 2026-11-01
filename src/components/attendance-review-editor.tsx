"use client";

import { useEffect, useState } from "react";

interface QueueItem {
  id: string;
  className: string;
  sectionName: string;
  sessionName: string;
  attendanceDate: string;
  status: "SUBMITTED";
}
interface ReviewDetail extends QueueItem {
  entries: Array<{
    enrollmentId: string;
    admissionNumber: string;
    givenName: string;
    familyName: string;
    mark: string;
  }>;
}
export function AttendanceReviewEditor({ schoolId }: { schoolId: string }) {
  const [pending, setPending] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    fetch(`/api/schools/${encodeURIComponent(schoolId)}/attendance-reviews`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then((data) => {
        if (live) {
          setPending(data.registers as QueueItem[]);
          setDetail(null);
        }
      })
      .catch(() => {
        if (live) {
          setMessage("Review queue unavailable or access revoked.");
          setPending([]);
          setDetail(null);
        }
      });
    return () => {
      live = false;
    };
  }, [schoolId, version]);

  async function show(id: string) {
    if (working) return;
    setWorking(true);
    setDetail(null);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance-reviews/${encodeURIComponent(id)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) {
        setMessage("Register unavailable or reviewer access revoked.");
        return;
      }
      setDetail((await response.json()).register as ReviewDetail);
      setReason("");
    } catch {
      setMessage("Unable to load register.");
    } finally {
      setWorking(false);
    }
  }
  async function decide(action: "APPROVE" | "RETURN") {
    if (!detail || reason.trim().length < 5 || working) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance/${encodeURIComponent(detail.id)}/decision`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        },
      );
      if (!response.ok) {
        setMessage(
          response.status === 409
            ? "This register was already decided."
            : "Decision denied or register no longer available.",
        );
        setDetail(null);
        setVersion((previous) => previous + 1);
        return;
      }
      setDetail(null);
      setReason("");
      setMessage(
        action === "APPROVE" ? "Attendance approved." : "Attendance returned.",
      );
      setVersion((previous) => previous + 1);
    } catch {
      setMessage("Unable to save review decision.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="review-queue-heading">
      <h2 id="review-queue-heading">Submitted attendance</h2>
      <button
        type="button"
        disabled={working}
        onClick={() => setVersion((value) => value + 1)}
      >
        Refresh pending queue
      </button>
      {pending.length === 0 && (
        <p>No pending registers are available for your verified sections.</p>
      )}
      <ul>
        {pending.map((item) => (
          <li key={item.id}>
            {item.sessionName} — {item.className} ({item.sectionName}),{" "}
            {item.attendanceDate}{" "}
            <button
              type="button"
              disabled={working}
              onClick={() => show(item.id)}
            >
              Review register
            </button>
          </li>
        ))}
      </ul>
      {detail && (
        <section aria-label="Review attendance details">
          <h3>
            {detail.className} — {detail.attendanceDate}
          </h3>
          <ul>
            {detail.entries.map((item) => (
              <li key={item.enrollmentId}>
                {item.admissionNumber} — {item.givenName} {item.familyName}:{" "}
                <strong>{item.mark}</strong>
              </li>
            ))}
          </ul>
          <label htmlFor="attendance-review-reason">
            Decision reason (minimum 5 characters)
          </label>
          <textarea
            id="attendance-review-reason"
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <p>
            Decisions are final; corrections must use a separate audited
            process.
          </p>
          <button
            type="button"
            disabled={working || reason.trim().length < 5}
            onClick={() => decide("APPROVE")}
          >
            Approve register
          </button>
          <button
            type="button"
            disabled={working || reason.trim().length < 5}
            onClick={() => decide("RETURN")}
          >
            Return register
          </button>
        </section>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
