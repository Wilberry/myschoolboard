"use client";

import { useEffect, useState, type FormEvent } from "react";

type Mode =
  | "ASSESSMENT_ONLY"
  | "GUARDIAN_AFTER_RELEASE"
  | "STUDENT_AFTER_RELEASE"
  | "GUARDIAN_AND_STUDENT_AFTER_RELEASE";
type Policy = {
  id: string;
  version: number;
  recipientMode: Mode;
  reason: string;
  adoptedAt: string;
};

export function ReportVisibilityPolicyWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}/report-visibility-policies`;
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [recipientMode, setRecipientMode] = useState<Mode | "">("");
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
      .then((body: { policies: Policy[] }) => {
        if (active) setPolicies(body.policies);
      })
      .catch(() => {
        if (active) {
          setPolicies([]);
          setMessage("Visibility configuration history is unavailable.");
        }
      });
    return () => {
      active = false;
    };
  }, [root, refresh]);

  async function adopt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !recipientMode || reason.trim().length < 5) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(root, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientMode, reason }),
      });
      if (!response.ok) throw new Error();
      setMessage(
        "Future visibility policy recorded. No report has been published and no pupil or guardian has gained access.",
      );
      setRecipientMode("");
      setReason("");
      setRefresh((value) => value + 1);
    } catch {
      setMessage(
        "Adoption denied. Check the chosen policy and your current school permissions.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="school-card" aria-labelledby="visibility-policy-heading">
      <h2 id="visibility-policy-heading">Future report recipient configuration</h2>
      <p>
        School Super Admin only. This records a future school preference,
        not publication approval or permission to read student grades. No
        report-card reader, release action or guardian access is enabled.
        Parent-first acknowledgment rules remain a separate pending decision.
      </p>
      <form onSubmit={adopt}>
        <label htmlFor="report-recipient-mode">Who may receive an approved report after a future release?</label>
        <select
          id="report-recipient-mode"
          required
          value={recipientMode}
          onChange={(event) => setRecipientMode(event.target.value as Mode | "")}
        >
          <option value="">Select a visibility policy</option>
          <option value="ASSESSMENT_ONLY">
            Assessment-only — no report-card recipients
          </option>
          <option value="GUARDIAN_AFTER_RELEASE">
            Verified guardians only, after a separate release
          </option>
          <option value="STUDENT_AFTER_RELEASE">
            Verified students only, after a separate release
          </option>
          <option value="GUARDIAN_AND_STUDENT_AFTER_RELEASE">
            Verified guardians and students, after a separate release
          </option>
        </select>
        <label htmlFor="report-visibility-reason">Reason for adoption</label>
        <textarea
          id="report-visibility-reason"
          required
          minLength={5}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !recipientMode || reason.trim().length < 5}
        >
          Adopt policy (do not publish any report)
        </button>
      </form>
      <h3>Immutable school policy history</h3>
      <ul>
        {policies.map((policy) => (
          <li key={policy.id}>
            Version {policy.version}: {policy.recipientMode} — {policy.reason}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
