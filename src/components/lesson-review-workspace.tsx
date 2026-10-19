"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

interface ReviewSummary {
  id: string;
  topic: string;
  kind: "LESSON_NOTE" | "SCHEME_OF_WORK";
  weekStart: number | null;
  weekEnd: number | null;
  classId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  currentRevision: number;
  submittedAt: string;
}

interface ReviewRevision {
  revisionNumber: number;
  topic: string;
  objectives: string;
  content: string;
  createdAt: string;
}

interface ReviewDetail extends ReviewSummary {
  revisions: ReviewRevision[];
}

export function LessonReviewWorkspace({
  schoolId,
  initialNotes,
}: {
  schoolId: string;
  initialNotes: ReviewSummary[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [active, setActive] = useState<ReviewDetail | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const base = `/api/schools/${encodeURIComponent(schoolId)}/lesson-note-reviews`;

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  function errorMessage(status: number) {
    return status === 409
      ? "This note has already changed or been reviewed. Refresh before deciding again."
      : status === 400
        ? "Please supply an action and a reason of at least five characters."
        : status === 401 || status === 404
          ? "Your reviewer access, section or this submitted note is no longer available."
          : "The request could not be completed. Please try again.";
  }

  async function openNote(noteId: string) {
    if (pending) return;
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const response = await fetch(`${base}/${encodeURIComponent(noteId)}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        setActive(null);
        setError(errorMessage(response.status));
        router.refresh();
        return;
      }
      const data: { note: ReviewDetail } = await response.json();
      setActive(data.note);
    } catch {
      setError("Could not load this note. No access was confirmed.");
      setActive(null);
    } finally {
      setPending(false);
    }
  }

  async function decide(
    event: FormEvent<HTMLFormElement>,
    action: "APPROVE" | "RETURN",
  ) {
    event.preventDefault();
    if (!active || pending) return;
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") ?? "").trim();
    if (reason.length < 5 || reason.length > 500) {
      setError("Enter a review reason of between 5 and 500 characters.");
      return;
    }
    if (
      !window.confirm(
        action === "APPROVE"
          ? "Approve this exact revision? Approval does not publish to students."
          : "Return this exact revision to its teacher for further work?",
      )
    )
      return;

    setPending(true);
    setError(null);
    setSuccess(null);
    const noteId = active.id;
    try {
      const response = await fetch(
        `${base}/${encodeURIComponent(noteId)}/decision`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            action,
            expectedRevision: active.currentRevision,
            reason,
          }),
        },
      );
      if (!response.ok) {
        setError(errorMessage(response.status));
        if (response.status === 404 || response.status === 409) {
          setActive(null);
          router.refresh();
        }
        return;
      }
      setNotes((previous) => previous.filter((item) => item.id !== noteId));
      setActive(null);
      form.reset();
      setSuccess(
        action === "APPROVE"
          ? "Revision approved and audit reason recorded. It is not released to students."
          : "Returned to the teacher for a new revision; audit reason recorded.",
      );
      router.refresh();
    } catch {
      setError("Connection failed. No review decision was confirmed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="setup-workspace lesson-review-workspace">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="setup-success" role="status">
          {success}
        </p>
      )}
      <section className="setup-panel" aria-labelledby="pending-review-title">
        <h2 id="pending-review-title">Pending section reviews</h2>
        <p>
          Only submitted notes for your current verified section grant are
          listed.
        </p>
        <ul className="setup-records">
          {notes.map((note) => (
            <li key={note.id}>
              <strong>
                {note.kind === "SCHEME_OF_WORK"
                  ? "Scheme of work"
                  : "Lesson note"}
                : {note.topic}
                {note.weekStart
                  ? ` (weeks ${note.weekStart}–${note.weekEnd})`
                  : ""}
              </strong>
              <span>
                {note.sectionName} · {note.className} · {note.subjectName}
              </span>
              <span>
                Revision {note.currentRevision} · Submitted{" "}
                {new Date(note.submittedAt).toLocaleDateString()}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => void openNote(note.id)}
              >
                View submitted revision
              </button>
            </li>
          ))}
          {notes.length === 0 && (
            <li>No submitted notes awaiting your review.</li>
          )}
        </ul>
      </section>

      {active && (
        <section
          className="setup-panel lesson-review-detail"
          aria-labelledby="review-note-title"
        >
          <h2 id="review-note-title">{active.topic}</h2>
          <p>
            {active.sectionName} · {active.className} · {active.subjectName}
          </p>
          <p>Submitted revision {active.currentRevision}</p>
          <ol className="lesson-revisions">
            {active.revisions.map((revision) => (
              <li key={revision.revisionNumber}>
                <strong>
                  Revision {revision.revisionNumber} · {revision.topic}
                </strong>
                <p>
                  <strong>Objectives:</strong> {revision.objectives}
                </p>
                <p className="lesson-revision-content">{revision.content}</p>
              </li>
            ))}
          </ol>
          <form onSubmit={(event) => void decide(event, "APPROVE")}>
            <label>
              Review reason
              <textarea
                name="reason"
                minLength={5}
                maxLength={500}
                rows={3}
                required
                placeholder="Record the reason for your decision"
              />
            </label>
            <div className="lesson-review-actions">
              <button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Approve revision"}
              </button>
            </div>
          </form>
          <form onSubmit={(event) => void decide(event, "RETURN")}>
            <label>
              Return-for-revision reason
              <textarea
                name="reason"
                minLength={5}
                maxLength={500}
                rows={3}
                required
                placeholder="Explain what should be corrected"
              />
            </label>
            <button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Return for revision"}
            </button>
          </form>
        </section>
      )}
      <p className="workspace-note">
        Review requires your current verified school section and the latest
        submitted revision. Approval is not publication and does not make notes
        visible to students.
      </p>
    </div>
  );
}
