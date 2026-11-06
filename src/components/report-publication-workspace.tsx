"use client";
import { useCallback, useEffect, useState } from "react";
type Composition = {
  className: string;
  subjectName: string;
  termName: string;
  sessionName: string;
  id: string;
  studentCount: number;
  evidenceRevision: number;
};
type Publication = {
  id: string;
  compositionId: string;
  visibility: string;
  withdrawn: boolean;
};
const modes = [
  ["ASSESSMENT_ONLY", "No recipient report access"],
  ["PARENT_ONLY", "Verified guardians only"],
  ["PARENT_FIRST", "Students after verified guardian acknowledgment"],
  ["PARENT_AND_STUDENT", "Verified guardians and linked students"],
] as const;
export function ReportPublicationWorkspace({ schoolId }: { schoolId: string }) {
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [compositionId, setCompositionId] = useState("");
  const [visibility, setVisibility] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const load = useCallback(async () => {
    const response = await fetch(`${root}/report-publications`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setCompositions([]);
      setPublications([]);
      throw Error();
    }
    const p = await response.json();
    setCompositions(p.compositions);
    setPublications(p.publications);
  }, [root]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void load().catch(() => {
        if (active) setMessage("Publication workspace unavailable.");
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load]);
  async function mutate(publicationId?: string) {
    if (reason.trim().length < 5 || reason.trim().length > 500) {
      setMessage("Enter a reason between 5 and 500 characters.");
      return;
    }
    if (!publicationId && (!compositionId || !visibility)) {
      setMessage("Select a composition and visibility policy.");
      return;
    }
    if (
      !window.confirm(
        publicationId
          ? "Withdraw this publication from recipients?"
          : "Publish this exact report version with the selected visibility policy?",
      )
    )
      return;
    setBusy(true);
    setMessage("Saving publication decision…");
    try {
      const response = await fetch(`${root}/report-publications`, {
        method: publicationId ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          publicationId
            ? { publicationId, reason }
            : { compositionId, visibility, reason },
        ),
      });
      if (!response.ok) throw Error();
      await load();
      setMessage(
        publicationId
          ? "Publication withdrawn. History is preserved."
          : "Report version published under the selected policy.",
      );
      setReason("");
    } catch {
      setMessage(
        "Decision unavailable. Permissions, source evidence or adopted policies may have changed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Report publication">
      <p>
        Publication releases an independently approved, frozen version. Select
        the school’s policy explicitly. Withdrawing preserves the audit history;
        corrections require a newly reviewed version.
      </p>
      <label htmlFor="report-composition">Approved composition</label>
      <select
        id="report-composition"
        value={compositionId}
        onChange={(e) => setCompositionId(e.target.value)}
      >
        <option value="">Select a version</option>
        {compositions
          .filter((c) => !publications.some((p) => p.compositionId === c.id))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.className} · {c.subjectName} · {c.termName} · {c.sessionName} ·
              Revision {c.evidenceRevision} · {c.studentCount} pupils
            </option>
          ))}
      </select>
      <label htmlFor="report-visibility">Recipient visibility</label>
      <select
        id="report-visibility"
        value={visibility}
        onChange={(e) => setVisibility(e.target.value)}
      >
        <option value="">Select policy</option>
        {modes.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor="report-release-reason">Decision reason</label>
      <textarea
        id="report-release-reason"
        minLength={5}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button disabled={busy} onClick={() => void mutate()}>
        Publish report version
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <h2>Publication history</h2>
      <ul>
        {publications.map((p) => (
          <li key={p.id}>
            Publication {p.id} · {p.visibility} ·{" "}
            {p.withdrawn ? "Withdrawn" : "Published"}{" "}
            {!p.withdrawn && (
              <button disabled={busy} onClick={() => void mutate(p.id)}>
                Withdraw publication
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
