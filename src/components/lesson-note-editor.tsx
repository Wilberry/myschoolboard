"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";

interface NoteSummary {
  id: string;
  topic: string;
  kind: "LESSON_NOTE" | "SCHEME_OF_WORK";
  weekStart: number | null;
  weekEnd: number | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";
  currentRevision: number;
  termId: string;
  assignmentId: string;
  updatedAt: string;
}

interface Revision {
  id: string;
  revisionNumber: number;
  topic: string;
  objectives: string;
  content: string;
  createdAt: string;
}

interface NoteDetail extends NoteSummary {
  revisions: Revision[];
  events: {
    eventType: "CREATED" | "REVISED" | "SUBMITTED" | "APPROVED" | "RETURNED";
    revisionNumber: number;
    reason: string | null;
    createdAt: string;
  }[];
}

export function LessonNoteEditor({
  schoolId,
  options,
}: {
  schoolId: string;
  options: LessonWritingOptions;
}) {
  const base = `/api/schools/${encodeURIComponent(schoolId)}/lesson-notes`;
  const [termsId, setTermsId] = useState("");
  const [kind, setKind] = useState<"LESSON_NOTE" | "SCHEME_OF_WORK">("LESSON_NOTE");
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [activeNote, setActiveNote] = useState<NoteDetail | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const eligibleAssignments = options.assignments.filter(
    (assignment) =>
      assignment.sessionId ===
      options.terms.find((term) => term.id === termsId)?.sessionId,
  );

  async function loadList() {
    const response = await fetch(base, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: { notes: NoteSummary[] } = await response.json();
    setNotes(data.notes);
  }

  useEffect(() => {
    let active = true;
    async function initialLoad() {
      try {
        const response = await fetch(
          `/api/schools/${encodeURIComponent(schoolId)}/lesson-notes`,
          { credentials: "same-origin", cache: "no-store" },
        );
        if (!response.ok) throw new Error("Cannot read own notes");
        const data: { notes: NoteSummary[] } = await response.json();
        if (active) setNotes(data.notes);
      } catch {
        if (active) {
          setError("The lesson-note list could not be loaded. Refresh or sign in again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialLoad();
    return () => {
      active = false;
    };
  }, [schoolId]);

  function responseMessage(status: number) {
    return status === 409
      ? "This lesson note changed or its workflow state conflicts. Reopen it before trying again."
      : status === 400
        ? "Check the topic, objectives, lesson content and form values."
        : status === 401 || status === 404
          ? "Your session, teaching assignment, academic term or note is no longer available."
          : "The operation could not be completed. Please try again.";
  }

  async function loadNote(id: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${base}/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        setActiveNote(null);
        setError(responseMessage(response.status));
        return;
      }
      const data: { note: NoteDetail } = await response.json();
      setActiveNote(data.note);
    } catch {
      setError("Could not open the lesson note. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function post(
    path: string,
    body: Record<string, string | number>,
  ): Promise<{ note: NoteSummary } | null> {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setError(responseMessage(response.status));
      return null;
    }
    return response.json();
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const result = await post(base, {
        termId: String(values.get("termId") ?? ""),
        assignmentId: String(values.get("assignmentId") ?? ""),
        topic: String(values.get("topic") ?? ""),
        objectives: String(values.get("objectives") ?? ""),
        content: String(values.get("content") ?? ""),
        kind,
        ...(kind === "SCHEME_OF_WORK" ? {
          weekStart: Number(values.get("weekStart")),
          weekEnd: Number(values.get("weekEnd")),
        } : {}),
      });
      if (!result) return;
      form.reset();
      setTermsId("");
      setKind("LESSON_NOTE");
      setSuccess("Draft saved. Only you can access it while your teaching assignment is active.");
      await loadList();
      setActiveNote(null);
    } catch {
      setError("The network connection failed. No saved draft was confirmed.");
    } finally {
      setPending(false);
    }
  }

  async function revise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeNote || (activeNote.status !== "DRAFT" && activeNote.status !== "RETURNED") || pending) return;
    const values = new FormData(event.currentTarget);
    const id = activeNote.id;
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const result = await post(`${base}/${encodeURIComponent(id)}/revisions`, {
        expectedRevision: activeNote.currentRevision,
        topic: String(values.get("topic") ?? ""),
        objectives: String(values.get("objectives") ?? ""),
        content: String(values.get("content") ?? ""),
      });
      if (!result) return;
      setSuccess("A new immutable revision has been saved.");
      await loadList();
      const response = await fetch(`${base}/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.ok) {
        const data: { note: NoteDetail } = await response.json();
        setActiveNote(data.note);
      } else {
        setActiveNote(null);
      }
    } catch {
      setError("The network connection failed. No revision was confirmed.");
    } finally {
      setPending(false);
    }
  }

  async function submitNote() {
    if (!activeNote || activeNote.status !== "DRAFT" || pending) return;
    if (
      !window.confirm(
        "Submit this revision for review? It cannot be edited unless the section reviewer returns it for revision.",
      )
    ) return;
    const id = activeNote.id;
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const result = await post(`${base}/${encodeURIComponent(id)}/submit`, {
        expectedRevision: activeNote.currentRevision,
      });
      if (!result) return;
      setSuccess("Submitted for review. This note is NOT approved or released to students.");
      await loadList();
      setActiveNote((previous) =>
        previous && previous.id === id
          ? { ...previous, status: "SUBMITTED" }
          : previous,
      );
    } catch {
      setError("The submission could not be confirmed. Please check the note status.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="setup-workspace lesson-workspace">
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="setup-success" role="status">{success}</p>}
      <section className="setup-panel" aria-labelledby="new-lesson-heading">
        <h2 id="new-lesson-heading">Create an academic planning draft</h2>
        <p>Choose an active academic term and an exact teaching assignment.</p>
        <form onSubmit={(event) => void create(event)}>
          <label>
            Academic term
            <select
              name="termId"
              required
              value={termsId}
              onChange={(event) => setTermsId(event.target.value)}
            >
              <option value="">Choose a term</option>
              {options.terms.map((term) => (
                <option value={term.id} key={term.id}>{term.name}</option>
              ))}
            </select>
          </label>
          <label>
            Class and subject
            <select key={termsId} name="assignmentId" required defaultValue="">
              <option value="">Choose your assignment</option>
              {eligibleAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Document type
            <select name="kind" value={kind} onChange={event =>
              setKind(event.target.value as "LESSON_NOTE" | "SCHEME_OF_WORK")}>
              <option value="LESSON_NOTE">Lesson note</option>
              <option value="SCHEME_OF_WORK">Scheme of work</option>
            </select>
          </label>
          {kind === "SCHEME_OF_WORK" && <>
            <label>First teaching week
              <input name="weekStart" type="number" min={1} max={53} required />
            </label>
            <label>Last teaching week
              <input name="weekEnd" type="number" min={1} max={53} required />
            </label>
          </>}
          <label>
            Topic
            <input name="topic" minLength={2} maxLength={180} required />
          </label>
          <label>
            Learning objectives
            <textarea name="objectives" minLength={5} maxLength={4000} required rows={3} />
          </label>
          <label>
            Lesson content
            <textarea name="content" minLength={10} maxLength={20000} required rows={8} />
          </label>
          <button
            type="submit"
            disabled={pending || eligibleAssignments.length === 0}
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
        </form>
      </section>

      <section className="setup-panel" aria-labelledby="my-lesson-heading">
        <h2 id="my-lesson-heading">My notes</h2>
        <p>Drafts remain private to the author. Submissions await a separate reviewer.</p>
        {loading && <p role="status">Loading your notes…</p>}
        <ul className="setup-records">
          {notes.map((note) => (
            <li key={note.id}>
              <strong>{note.topic}</strong>
              <span>{note.status} · Revision {note.currentRevision}</span>
              <button type="button" disabled={pending} onClick={() => void loadNote(note.id)}>
                Open note and history
              </button>
            </li>
          ))}
          {!loading && notes.length === 0 && <li>No eligible lesson notes yet.</li>}
        </ul>
      </section>

      {activeNote && (
        <section className="setup-panel lesson-detail" aria-labelledby="lesson-detail-heading">
          <h2 id="lesson-detail-heading">{activeNote.topic}</h2>
          <p>
            {activeNote.status} · Latest revision {activeNote.currentRevision}
          </p>
          {(activeNote.status === "DRAFT" || activeNote.status === "RETURNED") &&
            activeNote.revisions[0] && (
            <form
              key={`${activeNote.id}-${activeNote.currentRevision}`}
              onSubmit={(event) => void revise(event)}
            >
              <label>
                Topic
                <input
                  name="topic"
                  required minLength={2} maxLength={180}
                  defaultValue={activeNote.revisions[0].topic}
                />
              </label>
              <label>
                Learning objectives
                <textarea
                  name="objectives"
                  required minLength={5} maxLength={4000} rows={3}
                  defaultValue={activeNote.revisions[0].objectives}
                />
              </label>
              <label>
                Lesson content
                <textarea
                  name="content"
                  required minLength={10} maxLength={20000} rows={8}
                  defaultValue={activeNote.revisions[0].content}
                />
              </label>
              <button type="submit" disabled={pending}>Save new revision</button>
              {activeNote.status === "DRAFT" && (
                <button type="button" disabled={pending} onClick={() => void submitNote()}>
                  Submit for review
                </button>
              )}
            </form>
          )}
          {activeNote.status === "RETURNED" && (
            <p role="status">Returned for revision. Save a new revision before resubmitting.</p>
          )}
          {activeNote.status === "APPROVED" && (
            <p role="status">Approved by a section reviewer; not released to students.</p>
          )}
          {activeNote.events.some((event) => event.reason) && (
            <div>
              <h3>Review decisions</h3>
              <ul>
                {activeNote.events.filter((event) => event.reason).map((event, index) => (
                  <li key={`${event.eventType}-${event.revisionNumber}-${index}`}>
                    {event.eventType} · Revision {event.revisionNumber}: {event.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h3>Revision history</h3>
          <ol className="lesson-revisions">
            {activeNote.revisions.map((rev) => (
              <li key={rev.id}>
                <strong>Revision {rev.revisionNumber}: {rev.topic}</strong>
                <p><strong>Objectives:</strong> {rev.objectives}</p>
                <p className="lesson-revision-content">{rev.content}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="workspace-note">
        Submission is not approval or publication. Only exact active subject
        teachers can open these notes. No notes are visible to students.
      </p>
    </div>
  );
}
