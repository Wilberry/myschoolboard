"use client";
import { useEffect, useState } from "react";
interface Proposal {
  proposalId: string;
  title: string;
  kind: string;
  sectionName: string;
  className: string;
  subjectName: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  earnedPoints: number;
  maxPoints: number;
}
export function AssessmentManualReviewWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const [items, setItems] = useState<Proposal[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(
      `/api/schools/${encodeURIComponent(schoolId)}/assessment-manual-reviews`,
      { credentials: "same-origin", cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (active) setItems(data.proposals);
      })
      .catch(() => {
        if (active) {
          setItems([]);
          setStatus("Reviewer scope unavailable.");
        }
      });
    return () => {
      active = false;
    };
  }, [schoolId, refresh]);
  async function decide(proposalId: string, action: "APPROVED" | "RETURNED") {
    if (busy) return;
    const reason = reasons[proposalId]?.trim() ?? "";
    if (reason.length < 5) {
      setStatus("Provide at least five characters of reason.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-manual-reviews/${encodeURIComponent(proposalId)}/decision`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        },
      );
      if (!response.ok) throw Error();
      setStatus(
        `Manual mark ${action.toLowerCase()} for academic review only; no report was published.`,
      );
      setRefresh((x) => x + 1);
    } catch {
      setStatus("Decision denied, already decided or reviewer grant revoked.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="manual-review-heading">
      <h2 id="manual-review-heading">Verified-section manual mark review</h2>
      <p>
        Head of Section reviews Primary; Principal reviews Secondary. Your
        SECTION grant must be verified and current. Approvals retain the
        teacher&apos;s original mark and are not official result publication.
      </p>
      <ul>
        {items.map((x) => (
          <li key={x.proposalId}>
            <strong>
              {x.sectionName} · {x.className} · {x.subjectName}
            </strong>
            <p>
              {x.kind}: {x.title} — {x.admissionNumber} · {x.givenName}{" "}
              {x.familyName} — {x.earnedPoints}/{x.maxPoints}
            </p>
            <label htmlFor={`manual-review-reason-${x.proposalId}`}>
              Decision reason
            </label>
            <textarea
              id={`manual-review-reason-${x.proposalId}`}
              value={reasons[x.proposalId] ?? ""}
              maxLength={500}
              minLength={5}
              onChange={(e) =>
                setReasons((v) => ({ ...v, [x.proposalId]: e.target.value }))
              }
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void decide(x.proposalId, "APPROVED");
              }}
            >
              Approve initial mark
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void decide(x.proposalId, "RETURNED");
              }}
            >
              Return for correction workflow
            </button>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
