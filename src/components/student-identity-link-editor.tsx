"use client";
import { useState, type FormEvent } from "react";

export function StudentIdentityLinkEditor({ schoolId }: { schoolId: string }) {
  const [membershipId, setMembershipId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"LINK" | "REVOKE">("LINK");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !confirmed || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/student-identity-links`,
        { method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ membershipId, studentId, action, reason,
            identityConfirmed: true }),
        });
      setMessage(response.ok ? "Verified link event recorded. No earlier event was overwritten."
        : "Cannot verify this exact student account link or revocation.");
      if (response.ok) { setConfirmed(false); setReason(""); }
    } catch { setMessage("Network error. No identity change confirmed."); }
    finally { setBusy(false); }
  }
  return <section className="school-card" aria-labelledby="student-link-title">
    <h2 id="student-link-title">Verify a student account link</h2>
    <p>A student account must be independently verified against the school's student record before any lesson visibility. Never infer identity from email, name or admission number. Changes are audit events.</p>
    <form onSubmit={submit}>
      <label htmlFor="student-link-membership">Exact STUDENT membership ID</label>
      <input id="student-link-membership" required value={membershipId}
        onChange={e => setMembershipId(e.target.value)} maxLength={128} />
      <label htmlFor="student-link-student">Exact school student record ID</label>
      <input id="student-link-student" required value={studentId}
        onChange={e => setStudentId(e.target.value)} maxLength={128} />
      <label htmlFor="student-link-action">Action</label>
      <select id="student-link-action" value={action}
        onChange={e => setAction(e.target.value as "LINK" | "REVOKE")}>
        <option value="LINK">Verify and link</option>
        <option value="REVOKE">Revoke existing exact link</option>
      </select>
      <label htmlFor="student-link-reason">Verification evidence / reason (5–500 characters)</label>
      <textarea id="student-link-reason" minLength={5} maxLength={500} required
        value={reason} onChange={e => setReason(e.target.value)} />
      <label><input type="checkbox" checked={confirmed}
        onChange={e => setConfirmed(e.target.checked)} />
        I have independently verified the exact student account and school record.</label>
      <button type="submit" disabled={busy || !confirmed || reason.trim().length < 5}>
        Record {action === "LINK" ? "verification" : "revocation"}
      </button>
      <p role="status" aria-live="polite">{message}</p>
    </form>
  </section>;
}
