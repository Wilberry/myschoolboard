"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";

interface Question {
  id: string;
  assignmentId: string;
  termId: string;
  prompt: string;
}
interface Draft {
  id: string;
  kind: "QUIZ" | "TEST" | "EXAM";
  title: string;
  questionCount: number;
  maxScore: number;
  durationMinutes: number;
  maxAttempts: number;
  passPercent: number;
}
export function AssessmentDraftEditor({
  schoolId,
  options,
}: {
  schoolId: string;
  options: LessonWritingOptions;
}) {
  const [assignmentId, setAssignmentId] = useState("");
  const [termId, setTermId] = useState("");
  const [kind, setKind] = useState<"QUIZ" | "TEST" | "EXAM">("TEST");
  const [title, setTitle] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [duration, setDuration] = useState(30);
  const [attempts, setAttempts] = useState(1);
  const [passPercent, setPassPercent] = useState(50);
  const [points, setPoints] = useState<Record<string, number>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const assignment = options.assignments.find((a) => a.id === assignmentId);
  const terms = options.terms.filter(
    (t) => t.sessionId === assignment?.sessionId,
  );
  const available = questions.filter(
    (q) => q.assignmentId === assignmentId && q.termId === termId,
  );
  const selected = available.filter((q) => points[q.id] !== undefined);
  useEffect(() => {
    let active = true;
    const schoolPath = encodeURIComponent(schoolId);
    Promise.all([
      fetch(`/api/schools/${schoolPath}/assessment-questions`, {
        credentials: "same-origin",
        cache: "no-store",
      }),
      fetch(`/api/schools/${schoolPath}/assessment-drafts`, {
        credentials: "same-origin",
        cache: "no-store",
      }),
    ])
      .then(async ([q, d]) => {
        if (!q.ok || !d.ok) throw Error();
        return Promise.all([q.json(), d.json()]);
      })
      .then(([q, d]) => {
        if (active) {
          setQuestions(q.questions as Question[]);
          setDrafts(d.drafts as Draft[]);
        }
      })
      .catch(() => {
        if (active)
          setMessage("Draft and question access unavailable or revoked.");
      });
    return () => {
      active = false;
    };
  }, [schoolId, refresh]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !assignment ||
      !termId ||
      selected.length === 0 ||
      busy ||
      !starts ||
      !ends
    )
      return;
    const startsDate = new Date(starts);
    const endsDate = new Date(ends);
    if (
      !Number.isFinite(startsDate.getTime()) ||
      !Number.isFinite(endsDate.getTime())
    ) {
      setMessage("Select valid date and time values.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-drafts`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            termId,
            kind,
            title,
            startsAt: startsDate.toISOString(),
            endsAt: endsDate.toISOString(),
            durationMinutes: duration,
            maxAttempts: attempts,
            passPercent,
            questions: selected.map((q) => ({
              questionId: q.id,
              points: points[q.id],
            })),
          }),
        },
      );
      if (!response.ok) {
        setMessage(
          response.status === 400
            ? "Check the UTC schedule, term boundary, duration, attempts and question points."
            : "Draft creation denied; questions or assignment may no longer be eligible.",
        );
        return;
      }
      setMessage(
        "Immutable draft configuration saved. No student can take it yet.",
      );
      setTitle("");
      setPoints({});
      setRefresh((n) => n + 1);
    } catch {
      setMessage("Draft request failed; no save was confirmed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="assessment-draft-heading">
      <h2 id="assessment-draft-heading">
        Assessment configurations — drafts only
      </h2>
      <p>
        These configurations cannot be published or taken by students. Changes
        require a new immutable draft. Answer keys are never displayed.
      </p>
      <form onSubmit={save}>
        <label htmlFor="draft-assignment">
          My class and subject assignment
        </label>
        <select
          id="draft-assignment"
          required
          value={assignmentId}
          onChange={(e) => {
            setAssignmentId(e.target.value);
            setTermId("");
            setPoints({});
          }}
        >
          <option value="">Select assigned class and subject</option>
          {options.assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <label htmlFor="draft-term">Active term</label>
        <select
          id="draft-term"
          required
          value={termId}
          onChange={(e) => {
            setTermId(e.target.value);
            setPoints({});
          }}
        >
          <option value="">Select term in the assignment&apos;s session</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label htmlFor="draft-kind">Assessment type</label>
        <select
          id="draft-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as "QUIZ" | "TEST" | "EXAM")}
        >
          <option value="QUIZ">Quiz</option>
          <option value="TEST">Test</option>
          <option value="EXAM">Examination</option>
        </select>
        <label htmlFor="draft-title">Assessment title</label>
        <input
          id="draft-title"
          minLength={5}
          maxLength={180}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label htmlFor="draft-starts">
          Scheduled start (your local timezone, stored in UTC)
        </label>
        <input
          id="draft-starts"
          type="datetime-local"
          required
          value={starts}
          onChange={(e) => setStarts(e.target.value)}
        />
        <label htmlFor="draft-ends">
          Scheduled end (your local timezone, stored in UTC)
        </label>
        <input
          id="draft-ends"
          type="datetime-local"
          required
          value={ends}
          onChange={(e) => setEnds(e.target.value)}
        />
        <label htmlFor="draft-duration">Duration in minutes (5–180)</label>
        <input
          id="draft-duration"
          type="number"
          min={5}
          max={180}
          step={1}
          required
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
        <label htmlFor="draft-attempts">Maximum attempts (1–3)</label>
        <input
          id="draft-attempts"
          type="number"
          min={1}
          max={3}
          step={1}
          required
          value={attempts}
          onChange={(e) => setAttempts(Number(e.target.value))}
        />
        <label htmlFor="draft-pass">Passing percentage (0–100)</label>
        <input
          id="draft-pass"
          type="number"
          min={0}
          max={100}
          step={1}
          required
          value={passPercent}
          onChange={(e) => setPassPercent(Number(e.target.value))}
        />
        <fieldset>
          <legend>
            Select 1–50 questions from this exact assignment and term
          </legend>
          {available.length === 0 && (
            <p>
              No eligible questions have been authored for the selected term.
            </p>
          )}
          {available.map((q) => (
            <div key={q.id}>
              <label>
                <input
                  type="checkbox"
                  checked={points[q.id] !== undefined}
                  disabled={
                    busy ||
                    (selected.length >= 50 && points[q.id] === undefined)
                  }
                  onChange={(e) =>
                    setPoints((prev) => {
                      const updated = { ...prev };
                      if (e.target.checked) updated[q.id] = 1;
                      else delete updated[q.id];
                      return updated;
                    })
                  }
                />
                {q.prompt}
              </label>
              {points[q.id] !== undefined && (
                <label>
                  Marks for this question (1–20)
                  <input
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={points[q.id]}
                    onChange={(e) =>
                      setPoints((prev) => ({
                        ...prev,
                        [q.id]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              )}
            </div>
          ))}
        </fieldset>
        <button
          type="submit"
          disabled={
            busy ||
            !assignment ||
            !termId ||
            selected.length === 0 ||
            selected.length > 50
          }
        >
          Save draft-only assessment
        </button>
      </form>
      <h3>My draft configurations</h3>
      <ul>
        {drafts.map((d) => (
          <li key={d.id}>
            <strong>
              {d.kind} — {d.title}
            </strong>{" "}
            · {d.questionCount} questions ·{d.maxScore} marks ·{" "}
            {d.durationMinutes} minutes · {d.maxAttempts} attempts ·
            {d.passPercent}% passing mark · Not published
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
