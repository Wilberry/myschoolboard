"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
type Policy = { id: string; version: number; mode: string; adoptedAt: string };
type Composition = {
  id: string;
  className: string;
  subjectName: string;
  evidenceRevision: number;
  studentCount: number;
};
type Release = {
  id: string;
  compositionId: string;
  visibilityPolicyId: string;
  releaseOrdinal: number;
  className: string;
  subjectName: string;
  visibilityPolicyVersion: number;
  releasedAt: string;
};
const explanations: Record<string, string> = {
  SCHOOL_ONLY: "No pupil or guardian access; releases remain internal.",
  STUDENT_ONLY:
    "Only the exact verified student can read their own released grades.",
  GUARDIAN_ONLY:
    "Only currently verified guardians can read their linked child's released grades.",
  GUARDIAN_FIRST_ACK:
    "Guardians read first. The verified child reads only after a current guardian acknowledges each exact released subject.",
};
export function ReportReleaseWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [mode, setMode] = useState("SCHOOL_ONLY");
  const [policyReason, setPolicyReason] = useState("");
  const [compositionId, setCompositionId] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${root}/report-visibility-policies`, { cache: "no-store" }),
      fetch(`${root}/private-official-report-compositions`, {
        cache: "no-store",
      }),
      fetch(`${root}/report-recipient-releases`, { cache: "no-store" }),
    ])
      .then(async (responses) => {
        if (responses.some((r) => !r.ok))
          throw Error("Owner metadata unavailable");
        return Promise.all(responses.map((r) => r.json()));
      })
      .then(([visibility, frozen, published]) => {
        if (!active) return;
        setPolicies(visibility.policies);
        setCompositions(frozen.compositions);
        setReleases(published.releases);
      })
      .catch(() => {
        if (!active) return;
        setPolicies([]);
        setCompositions([]);
        setReleases([]);
        setMessage("Cannot verify owner status or private report evidence.");
      });
    return () => {
      active = false;
    };
  }, [root, refresh]);

  const selectedPolicy = policies[0];
  const alreadyReleased = new Set(
    releases
      .filter((r) => r.visibilityPolicyId === selectedPolicy?.id)
      .map((r) => r.compositionId),
  );
  async function adopt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || policyReason.trim().length < 5) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${root}/report-visibility-policies`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, reason: policyReason }),
      });
      if (!response.ok) throw Error("Not adopted");
      setPolicyReason("");
      setCompositionId("");
      setConfirmed(false);
      setMessage("Visibility revision adopted. No grades were released.");
      setRefresh((v) => v + 1);
    } catch {
      setMessage(
        "Policy adoption denied. Check the current school owner authority.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function release(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      !confirmed ||
      !compositionId ||
      !selectedPolicy ||
      releaseReason.trim().length < 5 ||
      alreadyReleased.has(compositionId)
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${root}/report-recipient-releases`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compositionId,
          visibilityPolicyId: selectedPolicy.id,
          reason: releaseReason,
          confirmRecipientRelease: true,
        }),
      });
      if (!response.ok) throw Error("Release denied");
      setReleaseReason("");
      setCompositionId("");
      setConfirmed(false);
      setMessage(
        "An independent immutable report release was recorded under the selected school policy.",
      );
      setRefresh((v) => v + 1);
    } catch {
      setMessage(
        "Release denied or disabled. Only verified, approved, current evidence can be released; no grades were disclosed by this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card">
      <h2>Explicit school report visibility</h2>
      <p>
        No publication policy is assumed. Each policy adoption is an immutable,
        audited version. A newer version suspends old recipient releases until
        the exact composition is independently released under that new version.
        Production recipient delivery is disabled until security verification
        enables the deployment controls.
      </p>
      <form onSubmit={adopt}>
        <label htmlFor="visibility-mode">School-selected visibility</label>
        <select
          id="visibility-mode"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          {Object.entries(explanations).map(([value]) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <p>{explanations[mode]}</p>
        <label htmlFor="visibility-reason">
          Reason for adopted policy version
        </label>
        <textarea
          id="visibility-reason"
          required
          minLength={5}
          maxLength={500}
          value={policyReason}
          onChange={(event) => setPolicyReason(event.target.value)}
        />
        <button disabled={busy || policyReason.trim().length < 5}>
          Adopt new policy revision (does not release grades)
        </button>
      </form>
      <h3>Current school policy</h3>
      <p>
        {selectedPolicy
          ? `Revision ${selectedPolicy.version}: ${selectedPolicy.mode}`
          : "No policy adopted — recipient release is blocked."}
      </p>
      <h3>Independent school-owner release</h3>
      <p>
        Inspect each class and subject in the{" "}
        <Link
          href={`/schools/${encodeURIComponent(schoolId)}/private-report-compositions`}
        >
          private grade preview
        </Link>{" "}
        before authorizing its exact frozen version. Releasing cannot be undone
        by editing history. A corrected result requires academic reapproval, a
        new composition and a new release.
      </p>
      <form onSubmit={release}>
        <label htmlFor="published-composition">
          Verified frozen composition
        </label>
        <select
          id="published-composition"
          required
          value={compositionId}
          onChange={(event) => {
            setCompositionId(event.target.value);
            setConfirmed(false);
          }}
        >
          <option value="">Select exact class/subject version</option>
          {compositions
            .filter((c) => !alreadyReleased.has(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.className} / {c.subjectName}, revision {c.evidenceRevision},
                {c.studentCount} pupils
              </option>
            ))}
        </select>
        <label htmlFor="publication-reason">
          Reason for independent release
        </label>
        <textarea
          id="publication-reason"
          required
          minLength={5}
          maxLength={500}
          value={releaseReason}
          onChange={(event) => setReleaseReason(event.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          I have inspected the frozen grades and explicitly authorize this exact
          release under policy revision{" "}
          {selectedPolicy?.version ?? "not selected"}.
        </label>
        <button
          disabled={
            busy ||
            !selectedPolicy ||
            !compositionId ||
            !confirmed ||
            releaseReason.trim().length < 5
          }
        >
          Record separate audited recipient release
        </button>
      </form>
      <h3>Immutable release history (metadata only)</h3>
      <ul>
        {releases.map((r) => (
          <li key={r.id}>
            {r.className} / {r.subjectName} — release version {r.releaseOrdinal}
            , policy revision {r.visibilityPolicyVersion} —{" "}
            {new Date(r.releasedAt).toLocaleString()}
          </li>
        ))}
      </ul>
      <p aria-live="polite" role="status">
        {message}
      </p>
    </section>
  );
}
