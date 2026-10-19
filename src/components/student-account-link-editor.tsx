"use client";
import { useEffect, useState, type FormEvent } from "react";
interface Link {
  id: string;
  studentId: string;
  studentMembershipId: string;
  createdAt: string;
  revocation: null | { createdAt: string };
}
export function StudentAccountLinkEditor({ schoolId }: { schoolId: string }) {
  const [studentId, setStudentId] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [links, setLinks] = useState<Link[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(`/api/schools/${encodeURIComponent(schoolId)}/student-links`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((r) => {
        if (active) setLinks(r.links);
      })
      .catch(() => {
        if (active) setMessage("Identity links are not available.");
      });
    return () => {
      active = false;
    };
  }, [schoolId, revision]);
  async function link(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !confirmed || reason.trim().length < 5) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/student-links`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            studentMembershipId: membershipId,
            reason,
            identityVerified: true,
          }),
        },
      );
      if (!response.ok) {
        setMessage(
          "Identity attestation denied, duplicated or no longer eligible.",
        );
        return;
      }
      setStudentId("");
      setMembershipId("");
      setConfirmed(false);
      setReason("");
      setMessage(
        "Permanent identity attestation recorded. Review IDs carefully.",
      );
      setRevision((v) => v + 1);
    } catch {
      setMessage("Identity attestation failed.");
    } finally {
      setBusy(false);
    }
  }
  async function revoke(linkId: string) {
    const explanation = window.prompt(
      "Enter the documented revocation reason (5–500 characters).",
    );
    if (!explanation || explanation.trim().length < 5 || busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/student-links/${encodeURIComponent(linkId)}/revoke`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: explanation }),
        },
      );
      setMessage(
        response.ok
          ? "Link revoked permanently."
          : "Revocation denied or already recorded.",
      );
      setRevision((v) => v + 1);
    } catch {
      setMessage("Unable to revoke link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="link-heading">
      <h2 id="link-heading">Attest student account identity</h2>
      <p>
        Enter the exact IDs from verified school records and the existing
        student membership. Matching names or email addresses is not evidence. A
        revoked link cannot be silently reassigned.
      </p>
      <form onSubmit={link}>
        <label htmlFor="linked-student">Enrolled StudentRecord ID</label>
        <input
          id="linked-student"
          required
          value={studentId}
          maxLength={128}
          onChange={(e) => setStudentId(e.target.value)}
        />
        <label htmlFor="linked-membership">Active STUDENT Membership ID</label>
        <input
          id="linked-membership"
          required
          value={membershipId}
          maxLength={128}
          onChange={(e) => setMembershipId(e.target.value)}
        />
        <label htmlFor="link-reason">
          Source/evidence of administrator verification (5–500 characters)
        </label>
        <textarea
          id="link-reason"
          required
          minLength={5}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I independently verified this student's identity and account
          membership.
        </label>
        <button
          type="submit"
          disabled={busy || !confirmed || reason.trim().length < 5}
        >
          Record permanent verified link
        </button>
      </form>
      <h3>School identity bindings</h3>
      <ul>
        {links.map((link) => (
          <li key={link.id}>
            Student {link.studentId} ↔ member {link.studentMembershipId}
            {link.revocation ? (
              " — Revoked"
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => revoke(link.id)}
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
