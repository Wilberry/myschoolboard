"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";

interface Question {
  id: string; classId: string; subjectId: string;
  prompt: string; options: string[];
}
export function AssessmentQuestionEditor({
  schoolId, options,
}: { schoolId: string; options: LessonWritingOptions }) {
  const [assignmentId, setAssignmentId] = useState("");
  const [termId, setTermId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [version, setVersion] = useState(0);

  const assignment = options.assignments.find(x => x.id === assignmentId);
  const terms = options.terms.filter(x => x.sessionId === assignment?.sessionId);
  useEffect(() => {
    let live = true;
    fetch(`/api/schools/${encodeURIComponent(schoolId)}/assessment-questions`,
      { credentials: "same-origin", cache: "no-store" })
      .then(async result => { if (!result.ok) throw Error(); return result.json(); })
      .then(result => { if (live) setQuestions(result.questions as Question[]); })
      .catch(() => { if (live) setMessage("Question list unavailable or teacher assignment revoked."); });
    return () => { live = false; };
  }, [schoolId, version]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !assignment || !termId || correctIndex === "") return;
    setWorking(true); setMessage("");
    try {
      const result = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-questions`,
        { method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId, termId, prompt, options: choices,
            correctIndex: Number(correctIndex),
          }),
        });
      if (!result.ok) {
        setMessage(result.status === 400 ? "Please check the question, distinct choices and selected correct option."
          : "Question creation denied or the academic assignment is no longer active.");
        return;
      }
      setPrompt(""); setChoices(["", "", "", ""]); setCorrectIndex("");
      setMessage("Question and private answer key saved as an immutable pair.");
      setVersion(n => n + 1);
    } catch {
      setMessage("Request failed; no save was confirmed.");
    } finally { setWorking(false); }
  }
  return <section className="school-card" aria-labelledby="question-bank-title">
    <h2 id="question-bank-title">Private question bank</h2>
    <p>Questions are restricted to your current class and subject assignment. Answer keys are never returned in the question list, and questions cannot yet be delivered to students.</p>
    <form onSubmit={submit}>
      <label htmlFor="question-assignment">My class and subject assignment</label>
      <select id="question-assignment" required value={assignmentId}
        onChange={e => { setAssignmentId(e.target.value); setTermId(""); }}>
        <option value="">Select an assigned class and subject</option>
        {options.assignments.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
      <label htmlFor="question-term">Active term</label>
      <select id="question-term" required value={termId}
        onChange={e => setTermId(e.target.value)}>
        <option value="">Select a term in that assignment's session</option>
        {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <label htmlFor="question-prompt">Question</label>
      <textarea id="question-prompt" required minLength={5} maxLength={2000}
        value={prompt} onChange={e => setPrompt(e.target.value)} />
      {choices.map((choice, i) =>
        <label key={i} htmlFor={`choice-${i}`}>
          Answer option {i + 1}
          <input id={`choice-${i}`} required minLength={1} maxLength={500}
            value={choice} onChange={e => setChoices(prev =>
              prev.map((value, index) => index === i ? e.target.value : value))} />
        </label>
      )}
      <label htmlFor="correct-answer">Correct option (kept private)</label>
      <select id="correct-answer" required value={correctIndex}
        onChange={e => setCorrectIndex(e.target.value)}>
        <option value="">Choose a correct option</option>
        {choices.map((_, i) => <option key={i} value={String(i)}>Option {i + 1}</option>)}
      </select>
      <button type="submit" disabled={working || !assignment || !termId || correctIndex === ""}>
        Save immutable question
      </button>
    </form>
    <button type="button" disabled={working} onClick={() => setVersion(n => n + 1)}>
      Refresh my questions
    </button>
    <h3>My saved question snapshots (answer keys hidden)</h3>
    <ul>{questions.map(question =>
      <li key={question.id}>
        <strong>{question.prompt}</strong>
        <ol>{question.options.map((option, i) =>
          <li key={i}>{option}</li>)}</ol>
      </li>)}</ul>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
