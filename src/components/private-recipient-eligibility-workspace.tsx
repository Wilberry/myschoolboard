"use client";

import { useEffect, useState, type FormEvent } from "react";

type Composition = {
  id: string;
  evidenceRevision: number;
  studentCount: number;
};
type Review = {
  id: string;
  compositionId: string;
  recipientRole: string;
  visibilityPolicyVersion: number;
  status: string;
};
export function PrivateRecipientEligibilityWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [history, setHistory] = useState<Review[]>([]);
  const [compositionId, setCompositionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [recipientMembershipId, setRecipientMembershipId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${root}/private-official-report-compositions`, {
        credentials: "same-origin", cache: "no-store",
      }),
      fetch(`${root}/private-recipient-eligibility`, {
        credentials: "same-origin", cache: "no-store",
      }),
    ])
      .then(async (responses) => {
        if (responses.some((response) => !response.ok)) throw new Error();
        return Promise.all(responses.map((response) => response.json()));
      })
      .then(([composed, reviewed]) => {
        if (!active) return;
        setCompositions(composed.compositions);
        setHistory(reviewed.evidence);
      })
      .catch(() => {
        if (!active) return;
        setCompositions([]);
        setHistory([]);
        setMessage("Eligibility evidence unavailable. No report is released.");
      });
    return () => { active = false; };
  }, [root, refresh]);

  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !compositionId || !studentId.trim() ||
      !recipientMembershipId.trim() || reason.trim().length < 5) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${root}/private-recipient-eligibility`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compositionId, studentId: studentId.trim(),
          recipientMembershipId: recipientMembershipId.trim(), reason,
        }),
      });
      if (!response.ok) throw new Error();
      setMessage("Private relationship review recorded. No grade access granted.");
      setCompositionId("");
      setStudentId("");
      setRecipientMembershipId("");
      setReason("");
      setRefresh((value) => value + 1);
    } catch {
      setMessage(
        "Review denied. Verify current report evidence, policy, private preflight and exact active account relationship.",
      );
    } finally { setBusy(false); }
  }
  return (
    <section className="school-card" aria-labelledby="recipient-review-heading">
      <h2 id="recipient-review-heading">Exact pupil/recipient review only</h2>
      <p>
        Select an existing private composition and enter the exact enrolled
        pupil and verified account membership IDs. The database repeats
        current academic checks, policy and relationship verification.
        This is NOT a result release, an acknowledgment of P-004, a report
        download, or permission to read a student's grade. An old review
        cannot authorize a future report request.
      </p>
      <form onSubmit={record}>
        <label htmlFor="recipient-report-composition">Private report composition</label>
        <select id="recipient-report-composition" required value={compositionId}
          onChange={(event) => setCompositionId(event.target.value)}>
          <option value="">Choose an unreleased report composition</option>
          {compositions.map((item) => (
            <option key={item.id} value={item.id}>
              Revision {item.evidenceRevision}, {item.studentCount} pupils
            </option>
          ))}
        </select>
        <label htmlFor="recipient-student-id">Exact pupil record ID</label>
        <input id="recipient-student-id" required maxLength={128}
          value={studentId} onChange={(event) => setStudentId(event.target.value)} />
        <label htmlFor="recipient-school-membership-id">
          Exact verified STUDENT or PARENT membership ID
        </label>
        <input id="recipient-school-membership-id" required maxLength={128}
          value={recipientMembershipId}
          onChange={(event) => setRecipientMembershipId(event.target.value)} />
        <label htmlFor="recipient-review-reason">Reason for private review</label>
        <textarea id="recipient-review-reason" required minLength={5} maxLength={500}
          value={reason} onChange={(event) => setReason(event.target.value)} />
        <button type="submit" disabled={busy || !compositionId ||
          !studentId.trim() || !recipientMembershipId.trim() ||
          reason.trim().length < 5}>
          Record internal eligibility review (no grade access)
        </button>
      </form>
      <h3>Private review history (no pupil details)</h3>
      <ul>{history.map((record) => (
        <li key={record.id}>
          {record.recipientRole} · school policy revision
          {" "}{record.visibilityPolicyVersion} · {record.status}
        </li>
      ))}</ul>
      <p role="status" aria-live="polite">{message}</p>
    </section>
  );
}
