"use client";

import { useEffect, useState, type FormEvent } from "react";

type Event = {
  id: string;
  studentId: string;
  guardianMembershipId: string;
  action: "VERIFY" | "REVOKE";
  ordinal: number;
  recordedAt: string;
};
export function GuardianRelationshipWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}/guardian-relationships`;
  const [events, setEvents] = useState<Event[]>([]);
  const [action, setAction] = useState<"VERIFY" | "REVOKE" | "">("");
  const [studentId, setStudentId] = useState("");
  const [guardianMembershipId, setGuardianMembershipId] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(root, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((body: { events: Event[] }) => {
        if (active) setEvents(body.events);
      })
      .catch(() => {
        if (!active) { return; }
        setEvents([]);
        setMessage("Relationship history unavailable. No guardian access is granted.");
      });
    return () => { active = false; };
  }, [root, refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !action || !studentId.trim() || !guardianMembershipId.trim() ||
      (action === "VERIFY" && !reviewed) || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(root, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, studentId: studentId.trim(),
          guardianMembershipId: guardianMembershipId.trim(),
          reason,
          ...(action === "VERIFY" ? { relationshipEvidenceReviewed: true } : {}),
        }),
      });
      if (!response.ok) throw new Error();
      setMessage("Relationship event recorded. No report or pupil data was released.");
      setAction(""); setStudentId(""); setGuardianMembershipId("");
      setReviewed(false); setReason(""); setRefresh((n) => n + 1);
    } catch {
      setMessage("Verification/revocation denied. Check the school, parent identity, active enrolment and prior events.");
    } finally { setBusy(false); }
  }
  return (
    <section className="school-card" aria-labelledby="guardian-relationship-heading">
      <h2 id="guardian-relationship-heading">Private guardian relationship evidence</h2>
      <p>
        Verify only after checking original school-approved relationship evidence
        for the exact parent account and enrolled pupil. Do not infer family
        links from matching names, phone numbers or email addresses. Each
        revocation is permanent audit history and may be followed by a fresh
        verification event.
      </p>
      <p>
        This is not parent-first report acknowledgment (P-004), a publication
        decision or permission to view any student grade. Parent/student
        report routes and downloads remain disabled.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="guardian-action">Relationship event</label>
        <select id="guardian-action" value={action} required
          onChange={(e) => { setAction(e.target.value as typeof action); setReviewed(false); }}>
          <option value="">Choose verification or revocation</option>
          <option value="VERIFY">Verify reviewed guardian relationship</option>
          <option value="REVOKE">Revoke prior verified relationship</option>
        </select>
        <label htmlFor="guardian-student-id">Exact pupil record ID</label>
        <input id="guardian-student-id" required maxLength={128} value={studentId}
          onChange={(e) => setStudentId(e.target.value)} />
        <label htmlFor="guardian-membership-id">Exact parent school-membership ID</label>
        <input id="guardian-membership-id" required maxLength={128}
          value={guardianMembershipId}
          onChange={(e) => setGuardianMembershipId(e.target.value)} />
        {action === "VERIFY" && (
          <label htmlFor="guardian-evidence-review">
            <input id="guardian-evidence-review" type="checkbox" checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)} />
            I have personally reviewed approved evidence establishing this exact
            parent's relationship to this pupil.
          </label>
        )}
        <label htmlFor="guardian-relationship-reason">Audit reason</label>
        <textarea id="guardian-relationship-reason" required minLength={5} maxLength={500}
          value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="submit" disabled={busy || !action || !studentId.trim() ||
          !guardianMembershipId.trim() || (action === "VERIFY" && !reviewed) ||
          reason.trim().length < 5}>
          Record relationship evidence (no report access)
        </button>
      </form>
      <h3>Immutable relationship history</h3>
      <ul>{events.map((item) => (
        <li key={item.id}>
          Pupil {item.studentId}; parent membership {item.guardianMembershipId};
          revision {item.ordinal}: {item.action}
        </li>
      ))}</ul>
      <p role="status" aria-live="polite">{message}</p>
    </section>
  );
}
