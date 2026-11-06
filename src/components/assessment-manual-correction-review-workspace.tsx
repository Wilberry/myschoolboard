"use client";
import { useEffect, useState } from "react";
type Item = {
  requestId: string;
  studentAdmission: string;
  componentTitle: string;
  originalPoints: number;
  proposedPoints: number;
  maxPoints: number;
  revision: number;
  reason: string;
};
export function AssessmentManualCorrectionReviewWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    fetch(
      `/api/schools/${encodeURIComponent(schoolId)}/assessment-manual-correction-reviews`,
      { credentials: "same-origin", cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (live) setItems(data.requests);
      })
      .catch(() => {
        if (live) setMessage("No verified correction reviewer access.");
      });
    return () => {
      live = false;
    };
  }, [schoolId, refresh]);
  async function decide(id: string, action: "APPROVED" | "RETURNED") {
    if (busy) return;
    const reason = (reasons[id] ?? "").trim();
    if (reason.length < 5) {
      setMessage("Explain the decision in at least five characters.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-manual-correction-reviews/${encodeURIComponent(id)}/decision`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        },
      );
      if (!response.ok) throw Error();
      setMessage(
        "Correction review recorded immutably; no official grades published.",
      );
      setRefresh((v) => v + 1);
    } catch {
      setMessage("Review denied or already decided; verify section grant.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="correction-review-title">
      <h2 id="correction-review-title">
        Review written-mark correction requests
      </h2>
      <p>
        Only verified Primary Head of Section or Secondary Principal for this
        exact class. Original marks cannot be overwritten.
      </p>
      <ul>
        {items.map((x) => (
          <li key={x.requestId}>
            <strong>
              {x.componentTitle} · {x.studentAdmission}
            </strong>
            <p>
              Original {x.originalPoints}/{x.maxPoints}; requested{" "}
              {x.proposedPoints}/{x.maxPoints}; correction revision {x.revision}
            </p>
            <p>Teacher reason: {x.reason}</p>
            <label htmlFor={`review-correction-${x.requestId}`}>
              Review reason
            </label>
            <textarea
              id={`review-correction-${x.requestId}`}
              value={reasons[x.requestId] ?? ""}
              maxLength={500}
              onChange={(e) =>
                setReasons((v) => ({ ...v, [x.requestId]: e.target.value }))
              }
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void decide(x.requestId, "APPROVED");
              }}
            >
              Approve correction
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void decide(x.requestId, "RETURNED");
              }}
            >
              Return correction
            </button>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
