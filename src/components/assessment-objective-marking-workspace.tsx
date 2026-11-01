"use client";
import { useEffect, useState } from "react";
interface Candidate {
  attemptId: string;
  title: string;
  className: string;
  subjectName: string;
  admissionNumber: string;
  attemptNumber: number;
}
export function AssessmentObjectiveMarkingWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const [attempts, setAttempts] = useState<Candidate[]>([]);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    let live = true;
    fetch(
      `/api/schools/${encodeURIComponent(schoolId)}/assessment-score-queue`,
      { cache: "no-store", credentials: "same-origin" },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((body) => {
        if (live) setAttempts(body.attempts);
      })
      .catch(() => {
        if (live) {
          setAttempts([]);
          setStatus("No marking access.");
        }
      });
    return () => {
      live = false;
    };
  }, [schoolId, reload]);
  async function mark(attemptId: string) {
    if (busy) return;
    setBusy(attemptId);
    setStatus("");
    try {
      const r = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-scores/${encodeURIComponent(attemptId)}`,
        { method: "POST", credentials: "same-origin", cache: "no-store" },
      );
      if (!r.ok) throw Error();
      const data = (await r.json()) as {
        score: {
          earnedPoints: number;
          maxPoints: number;
          passed: boolean;
        };
      };
      setStatus(
        `Immutable provisional score recorded: ${data.score.earnedPoints} of ${data.score.maxPoints} marks. No student result was published.`,
      );
      setReload((n) => n + 1);
    } catch {
      setStatus("Marking not authorized or submission unavailable.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="school-card" aria-labelledby="scoring-title">
      <h2 id="scoring-title">Teacher-controlled objective marking</h2>
      <p>
        Only submitted attempts from your exact active class/subject assignment.
        The server calculates marks using private answer keys; this screen never
        displays correct answers or individual responses. Scores remain
        provisional.
      </p>
      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => setReload((n) => n + 1)}
      >
        Refresh submitted attempts
      </button>
      <ul>
        {attempts.map((a) => (
          <li key={a.attemptId}>
            <strong>{a.title}</strong> · {a.className} · {a.subjectName} ·
            {a.admissionNumber} · Attempt {a.attemptNumber}
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                void mark(a.attemptId);
              }}
            >
              Compute immutable objective score
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
