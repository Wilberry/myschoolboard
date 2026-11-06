"use client";
import { useEffect, useState, type FormEvent } from "react";

interface Option {
  id: string;
  name: string;
  sessionId?: string;
}
interface Revision {
  id: string;
  sessionId: string;
  termId: string;
  classId: string;
  subjectId: string;
  version: number;
  quizWeight: number;
  testWeight: number;
  examWeight: number;
  reason: string;
}
export function AssessmentGradingPolicyEditor({
  schoolId,
  sessions,
  terms,
  classes,
  subjects,
}: {
  schoolId: string;
  sessions: Option[];
  terms: Option[];
  classes: Option[];
  subjects: Option[];
}) {
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [quizWeight, setQuizWeight] = useState(20);
  const [testWeight, setTestWeight] = useState(30);
  const [examWeight, setExamWeight] = useState(50);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<Revision[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const total = quizWeight + testWeight + examWeight;
  useEffect(() => {
    let live = true;
    fetch(
      `/api/schools/${encodeURIComponent(schoolId)}/assessment-grading-policies`,
      { cache: "no-store", credentials: "same-origin" },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((r) => {
        if (live) setHistory(r.policies);
      })
      .catch(() => {
        if (live) setMessage("Policy history unavailable.");
      });
    return () => {
      live = false;
    };
  }, [schoolId, refresh]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      total !== 100 ||
      !sessionId ||
      !termId ||
      !classId ||
      !subjectId ||
      reason.trim().length < 5
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-grading-policies`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            termId,
            classId,
            subjectId,
            quizWeight,
            testWeight,
            examWeight,
            reason,
          }),
        },
      );
      if (!r.ok) throw Error();
      const p = (await r.json()) as { policy: Revision };
      setMessage(
        `Draft-only grading revision ${p.policy.version} recorded; no official marks or reports changed.`,
      );
      setReason("");
      setRefresh((n) => n + 1);
    } catch {
      setMessage(
        "Grading revision was rejected. Check academic structure, rights and weights.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="grading-policy-title">
      <h2 id="grading-policy-title">Configure provisional grading preview</h2>
      <p>
        This is a non-production academic-policy draft. No profile is assumed
        for any school. Saving creates an immutable revision, not a published
        grade rule.
      </p>
      <form onSubmit={save}>
        <label htmlFor="grading-session">Active academic session</label>
        <select
          id="grading-session"
          required
          value={sessionId}
          onChange={(e) => {
            setSessionId(e.target.value);
            setTermId("");
          }}
        >
          <option value="">Choose session</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label htmlFor="grading-term">Active term</label>
        <select
          id="grading-term"
          required
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
        >
          <option value="">Choose term</option>
          {terms
            .filter((t) => t.sessionId === sessionId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
        <label htmlFor="grading-class">Class</label>
        <select
          id="grading-class"
          required
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">Choose class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label htmlFor="grading-subject">Subject</label>
        <select
          id="grading-subject"
          required
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          <option value="">Choose subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label htmlFor="grading-quiz">Quiz weight (%)</label>
        <input
          id="grading-quiz"
          required
          type="number"
          min={0}
          max={100}
          step={1}
          value={quizWeight}
          onChange={(e) => setQuizWeight(Number(e.target.value))}
        />
        <label htmlFor="grading-test">Test weight (%)</label>
        <input
          id="grading-test"
          required
          type="number"
          min={0}
          max={100}
          step={1}
          value={testWeight}
          onChange={(e) => setTestWeight(Number(e.target.value))}
        />
        <label htmlFor="grading-exam">Exam weight (%)</label>
        <input
          id="grading-exam"
          required
          type="number"
          min={0}
          max={100}
          step={1}
          value={examWeight}
          onChange={(e) => setExamWeight(Number(e.target.value))}
        />
        <p>
          Total: <strong>{total}%</strong> — required: 100%
        </p>
        <label htmlFor="grading-reason">Revision reason</label>
        <textarea
          id="grading-reason"
          required
          minLength={5}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button type="submit" disabled={busy || total !== 100}>
          Save immutable draft revision
        </button>
      </form>
      <h3>Recent grading preview revisions (never official)</h3>
      <ul>
        {history.map((p) => (
          <li key={p.id}>
            Revision {p.version}: {p.quizWeight}% quiz / {p.testWeight}% test /
            {p.examWeight}% exam — {p.reason}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
