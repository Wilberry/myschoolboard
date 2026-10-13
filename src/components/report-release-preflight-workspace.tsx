"use client";

import { useEffect, useState, type FormEvent } from "react";

type Composition = {
  id: string;
  evidenceRevision: number;
  studentCount: number;
  status: string;
};
type Policy = {
  id: string;
  version: number;
  recipientMode: string;
};
type Preflight = {
  id: string;
  compositionId: string;
  visibilityPolicyVersion: number;
  recipientMode: string;
  studentCount: number;
  status: string;
};
export function ReportReleasePreflightWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [preflights, setPreflights] = useState<Preflight[]>([]);
  const [compositionId, setCompositionId] = useState("");
  const [visibilityPolicyId, setVisibilityPolicyId] = useState("");
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
      fetch(`${root}/report-visibility-policies`, {
        credentials: "same-origin", cache: "no-store",
      }),
      fetch(`${root}/report-release-preflights`, {
        credentials: "same-origin", cache: "no-store",
      }),
    ])
      .then(async (responses) => {
        if (responses.some((response) => !response.ok)) throw new Error();
        return Promise.all(responses.map((response) => response.json()));
      })
      .then(([c, p, a]) => {
        if (!active) return;
        setCompositions(c.compositions);
        setPolicies(p.policies);
        setPreflights(a.preflights);
      })
      .catch(() => {
        if (!active) return;
        setCompositions([]);
        setPolicies([]);
        setPreflights([]);
        setMessage("Private readiness evidence is unavailable. No report was released.");
      });
    return () => { active = false; };
  }, [root, refresh]);

  const currentPolicy = policies[0];
  const supportedRecipientPolicy =
    currentPolicy && currentPolicy.recipientMode !== "ASSESSMENT_ONLY"
      ? currentPolicy : null;

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy || !compositionId || !visibilityPolicyId ||
      visibilityPolicyId !== supportedRecipientPolicy?.id ||
      reason.trim().length < 5
    ) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${root}/report-release-preflights`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compositionId, visibilityPolicyId, reason,
        }),
      });
      if (!response.ok) throw new Error();
      setMessage(
        "Private preflight recorded. This does NOT authorize or publish reports.",
      );
      setCompositionId("");
      setVisibilityPolicyId("");
      setReason("");
      setRefresh((value) => value + 1);
    } catch {
      setMessage(
        "Preflight denied: evidence, approval, school policy or privileges may be stale.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="school-card" aria-labelledby="release-preflight-heading">
      <h2 id="release-preflight-heading">Unreleased report evidence inspection</h2>
      <p>
        This is NOT an official publication approval, report download, access
        grant or recipient visibility control. The database rechecks current
        academic authority and the exact frozen grade calculation. A successful
        preflight can become stale immediately; any eventual publication must
        repeat all checks. Parent-first acknowledgment remains unresolved.
      </p>
      <form onSubmit={inspect}>
        <label htmlFor="release-composition">Private report composition</label>
        <select id="release-composition" value={compositionId} required
          onChange={(event) => setCompositionId(event.target.value)}>
          <option value="">Choose unreleased composition</option>
          {compositions.map((item) => (
            <option key={item.id} value={item.id}>
              Evidence revision {item.evidenceRevision}, {item.studentCount} pupils
            </option>
          ))}
        </select>
        <label htmlFor="release-visibility">Current adopted recipient preference</label>
        <select id="release-visibility" value={visibilityPolicyId} required
          onChange={(event) => setVisibilityPolicyId(event.target.value)}>
          <option value="">Choose current non-assessment-only school policy</option>
          {supportedRecipientPolicy && (
            <option value={supportedRecipientPolicy.id}>
              Version {supportedRecipientPolicy.version}: {supportedRecipientPolicy.recipientMode}
            </option>
          )}
        </select>
        {!supportedRecipientPolicy && (
          <p>No adopted report-recipient policy is eligible for preflight.</p>
        )}
        <label htmlFor="preflight-reason">Reason for internal preflight</label>
        <textarea id="preflight-reason" required minLength={5} maxLength={500}
          value={reason} onChange={(event) => setReason(event.target.value)} />
        <button type="submit" disabled={
          busy || !compositionId || !visibilityPolicyId ||
          visibilityPolicyId !== supportedRecipientPolicy?.id ||
          reason.trim().length < 5
        }>
          Record private readiness check (never publish)
        </button>
      </form>
      <h3>Internal attestation history</h3>
      <ul>
        {preflights.map((item) => (
          <li key={item.id}>
            {item.studentCount} pupils; visibility version {item.visibilityPolicyVersion}
            {" — "}{item.recipientMode} — {item.status}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">{message}</p>
    </section>
  );
}
