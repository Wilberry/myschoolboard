"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";

type Component = {
  id: string;
  title: string;
  kind: "QUIZ" | "TEST" | "EXAM";
  maxPoints: number;
  termId: string;
  classId: string;
};
type Pupil = {
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  proposed: boolean;
};
export function AssessmentManualMarkEditor({
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
  const [maxPoints, setMaxPoints] = useState(20);
  const [components, setComponents] = useState<Component[]>([]);
  const [componentId, setComponentId] = useState("");
  const [students, setStudents] = useState<Pupil[]>([]);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const assignment = options.assignments.find((a) => a.id === assignmentId);
  const terms = options.terms.filter(
    (t) => t.sessionId === assignment?.sessionId,
  );
  const component = components.find((c) => c.id === componentId);
  const api = `/api/schools/${encodeURIComponent(schoolId)}`;
  useEffect(() => {
    let live = true;
    fetch(`${api}/assessment-manual-components`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (live) setComponents(data.components);
      })
      .catch(() => {
        if (live) setMessage("Manual component access unavailable.");
      });
    return () => {
      live = false;
    };
  }, [api, refresh]);
  useEffect(() => {
    if (!componentId) {
      setStudents([]);
      return;
    }
    let live = true;
    fetch(
      `${api}/assessment-manual-components/${encodeURIComponent(componentId)}/students`,
      {
        cache: "no-store",
        credentials: "same-origin",
      },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (live) setStudents(data.students);
      })
      .catch(() => {
        if (live) {
          setStudents([]);
          setMessage("Student roster no longer authorized.");
        }
      });
    return () => {
      live = false;
    };
  }, [api, componentId, refresh]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !assignment || !termId) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`${api}/assessment-manual-components`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, termId, kind, title, maxPoints }),
      });
      if (!r.ok) throw Error();
      const data = (await r.json()) as { component: Component };
      setComponentId(data.component.id);
      setTitle("");
      setRefresh((v) => v + 1);
      setMessage(
        "Written assessment definition saved. Marks remain unapproved.",
      );
    } catch {
      setMessage("Cannot create the component for this exact assignment.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(studentId: string) {
    if (!component || busy) return;
    const earnedPoints = Number(points[studentId]);
    if (
      points[studentId] === undefined ||
      !Number.isInteger(earnedPoints) ||
      earnedPoints < 0 ||
      earnedPoints > component.maxPoints ||
      (reason[studentId] ?? "").trim().length < 5
    ) {
      setMessage(
        "Enter valid whole marks and a reason of at least five characters.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`${api}/assessment-manual-proposals`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentId: component.id,
          studentId,
          earnedPoints,
          reason: reason[studentId],
        }),
      });
      if (!r.ok) throw Error();
      setMessage(
        "Immutable mark proposal recorded, not approved or added to results.",
      );
      setRefresh((v) => v + 1);
    } catch {
      setMessage(
        "Proposal rejected: enrollment/assignment may have changed, or a proposal exists.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="manual-mark-heading">
      <h2 id="manual-mark-heading">Written and offline assessment proposals</h2>
      <p>
        Teacher-only academic drafts. One initial proposal per pupil and
        component. No official score, report card or class-sheet total changes.
        Corrections require a separately reviewed process.
      </p>
      <form onSubmit={create}>
        <label htmlFor="manual-assignment">
          Current assigned class and subject
        </label>
        <select
          id="manual-assignment"
          required
          value={assignmentId}
          onChange={(e) => {
            setAssignmentId(e.target.value);
            setTermId("");
          }}
        >
          <option value="">Choose assignment</option>
          {options.assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <label htmlFor="manual-term">Active term</label>
        <select
          id="manual-term"
          required
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
        >
          <option value="">Choose term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label htmlFor="manual-kind">Assessment category</label>
        <select
          id="manual-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as "QUIZ" | "TEST" | "EXAM")}
        >
          <option value="QUIZ">Quiz</option>
          <option value="TEST">Test</option>
          <option value="EXAM">Examination</option>
        </select>
        <label htmlFor="manual-title">Assessment title</label>
        <input
          id="manual-title"
          required
          minLength={5}
          maxLength={180}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label htmlFor="manual-max">Maximum marks (1–100)</label>
        <input
          id="manual-max"
          type="number"
          min={1}
          max={100}
          step={1}
          required
          value={maxPoints}
          onChange={(e) => setMaxPoints(Number(e.target.value))}
        />
        <button type="submit" disabled={busy || !assignment || !termId}>
          Create immutable written component
        </button>
      </form>
      <h3>My current written components</h3>
      <label htmlFor="manual-component">Select a component to mark</label>
      <select
        id="manual-component"
        value={componentId}
        onChange={(e) => {
          setComponentId(e.target.value);
          setStudents([]);
        }}
      >
        <option value="">Select component</option>
        {components.map((c) => (
          <option key={c.id} value={c.id}>
            {c.kind}: {c.title} ({c.maxPoints} marks)
          </option>
        ))}
      </select>
      {component && (
        <ul>
          {students.map((p) => (
            <li key={p.studentId}>
              <strong>
                {p.admissionNumber} — {p.givenName} {p.familyName}
              </strong>
              {p.proposed ? (
                <p>Proposal already recorded; no second proposal allowed.</p>
              ) : (
                <div>
                  <label htmlFor={`manual-points-${p.studentId}`}>
                    Earned marks / {component.maxPoints}
                  </label>
                  <input
                    id={`manual-points-${p.studentId}`}
                    type="number"
                    min={0}
                    max={component.maxPoints}
                    step={1}
                    value={points[p.studentId] ?? ""}
                    onChange={(e) =>
                      setPoints((v) => ({
                        ...v,
                        [p.studentId]: e.target.value,
                      }))
                    }
                  />
                  <label htmlFor={`manual-reason-${p.studentId}`}>
                    Marking note/reason
                  </label>
                  <input
                    id={`manual-reason-${p.studentId}`}
                    maxLength={500}
                    value={reason[p.studentId] ?? ""}
                    onChange={(e) =>
                      setReason((v) => ({
                        ...v,
                        [p.studentId]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void submit(p.studentId);
                    }}
                  >
                    Save unapproved mark proposal
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
