"use client";
import { useEffect, useState } from "react";
type Mark = {
  proposalId: string;
  componentTitle: string;
  studentAdmission: string;
  originalPoints: number;
  approvedPoints: number | null;
  maxPoints: number;
  latestRevision: number;
  pending: boolean;
};
export function AssessmentManualCorrectionWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    fetch(
      `/api/schools/${encodeURIComponent(schoolId)}/assessment-manual-corrections`,
      { cache: "no-store", credentials: "same-origin" },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (live) setMarks(data.marks);
      })
      .catch(() => {
        if (live) setMessage("Current exact teacher mark access unavailable.");
      });
    return () => {
      live = false;
    };
  }, [refresh, schoolId]);
  async function propose(mark: Mark) {
    if (busy) return;
    const proposedPoints = Number(points[mark.proposalId]);
    const reason = (reasons[mark.proposalId] ?? "").trim();
    if (
      points[mark.proposalId] === undefined ||
      !Number.isInteger(proposedPoints) ||
      proposedPoints < 0 ||
      proposedPoints > mark.maxPoints ||
      reason.length < 5
    ) {
      setMessage(
        "Enter valid whole marks and a reason of five characters or more.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-manual-corrections`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposalId: mark.proposalId,
            proposedPoints,
            reason,
          }),
        },
      );
      if (!response.ok) throw Error();
      setMessage(
        "Append-only correction requested. Existing approved mark remains until independent approval.",
      );
      setRefresh((v) => v + 1);
    } catch {
      setMessage(
        "Correction denied, already pending, or source grant revoked.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="correction-teacher-title">
      <h2 id="correction-teacher-title">Request written-mark corrections</h2>
      <p>
        Only original active teachers. All prior marks are preserved; a
        different section-authorized academic reviewer must approve changes. No
        official result is released.
      </p>
      <ul>
        {marks.map((mark) => (
          <li key={mark.proposalId}>
            <strong>
              {mark.componentTitle} — {mark.studentAdmission}
            </strong>
            <p>
              Original {mark.originalPoints}/{mark.maxPoints}; latest approved{" "}
              {mark.approvedPoints === null
                ? "Not yet approved"
                : `${mark.approvedPoints}/${mark.maxPoints}`}
              ; revision {mark.latestRevision}
            </p>
            {mark.pending ? (
              <p>A correction awaits review.</p>
            ) : (
              <>
                <label htmlFor={`correct-points-${mark.proposalId}`}>
                  Proposed whole marks
                </label>
                <input
                  id={`correct-points-${mark.proposalId}`}
                  type="number"
                  min={0}
                  max={mark.maxPoints}
                  step={1}
                  value={points[mark.proposalId] ?? ""}
                  onChange={(e) =>
                    setPoints((v) => ({
                      ...v,
                      [mark.proposalId]: e.target.value,
                    }))
                  }
                />
                <label htmlFor={`correct-reason-${mark.proposalId}`}>
                  Correction reason
                </label>
                <textarea
                  id={`correct-reason-${mark.proposalId}`}
                  value={reasons[mark.proposalId] ?? ""}
                  maxLength={500}
                  onChange={(e) =>
                    setReasons((v) => ({
                      ...v,
                      [mark.proposalId]: e.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void propose(mark);
                  }}
                >
                  Submit correction for independent review
                </button>
              </>
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
