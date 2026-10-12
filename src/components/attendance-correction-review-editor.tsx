"use client";

import { useEffect, useState } from "react";
interface QueueItem { id: string; registerId: string; className: string;
  sectionName: string; attendanceDate: string; createdAt: string }
interface Detail extends QueueItem {
  admissionNumber: string; givenName: string; familyName: string;
  originalMark: string; expectedMark: string; proposedMark: string;
  requestReason: string; revision: number;
}
export function AttendanceCorrectionReviewEditor({ schoolId }: { schoolId: string }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`/api/schools/${encodeURIComponent(schoolId)}/attendance-correction-reviews`,
      { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      }).then(data => {
        if (live) { setQueue(data.corrections as QueueItem[]); setDetail(null); }
      }).catch(() => { if (live) {
        setQueue([]); setDetail(null); setMessage("Correction queue unavailable or access revoked.");
      } });
    return () => { live = false; };
  }, [schoolId, reload]);

  async function open(id: string) {
    if (working) return;
    setWorking(true); setDetail(null); setReason("");
    setConfirmed(false); setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance-correction-reviews/${encodeURIComponent(id)}`,
        { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      setDetail((await response.json()).correction as Detail);
    } catch {
      setMessage("Correction detail unavailable or reviewer section scope revoked.");
    } finally { setWorking(false); }
  }
  async function decide(action: "APPROVE" | "RETURN") {
    if (!detail || working || !confirmed || reason.trim().length < 5) return;
    setWorking(true); setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance-corrections/${encodeURIComponent(detail.id)}/decision`,
        { method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        });
      if (!response.ok) {
        setMessage(response.status === 409 ? "This correction was already decided."
          : "Correction no longer pending or reviewer access denied.");
      } else {
        setMessage(action === "APPROVE" ? "Correction approved. Original entry preserved."
          : "Correction returned without changing the effective mark.");
      }
      setDetail(null); setReason(""); setConfirmed(false); setReload(n => n + 1);
    } catch {
      setMessage("Unable to record correction decision.");
    } finally { setWorking(false); }
  }
  return <section className="school-card" aria-labelledby="correction-queue-heading">
    <h2 id="correction-queue-heading">Pending corrections</h2>
    <button type="button" disabled={working} onClick={() => setReload(n => n + 1)}>
      Refresh correction queue
    </button>
    {queue.length === 0 && <p>No pending corrections are available for your verified sections.</p>}
    <ul>{queue.map(item => <li key={item.id}>
      {item.className} · {item.sectionName} · {item.attendanceDate}{" "}
      <button type="button" disabled={working} onClick={() => open(item.id)}>Review request</button>
    </li>)}</ul>
    {detail && <section aria-label="Correction detail">
      <h3>{detail.className} · {detail.attendanceDate}</h3>
      <p>{detail.admissionNumber} — {detail.givenName} {detail.familyName}</p>
      <p>Original: <strong>{detail.originalMark}</strong>; currently effective:
        <strong> {detail.expectedMark}</strong>; proposed:
        <strong> {detail.proposedMark}</strong></p>
      <p>Requester explanation: {detail.requestReason}</p>
      <p>Correction revision: {detail.revision}. This approval does not modify the original register.</p>
      <label htmlFor="correction-review-reason">Reviewer decision reason</label>
      <textarea id="correction-review-reason" required minLength={5} maxLength={500}
        value={reason} onChange={event => setReason(event.target.value)} />
      <label>
        <input type="checkbox" checked={confirmed}
          onChange={event => setConfirmed(event.target.checked)} />
        I reviewed the original entry and proposed correction.
      </label>
      <button type="button" onClick={() => decide("APPROVE")}
        disabled={working || !confirmed || reason.trim().length < 5}>Approve correction</button>
      <button type="button" onClick={() => decide("RETURN")}
        disabled={working || !confirmed || reason.trim().length < 5}>Return correction</button>
    </section>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
