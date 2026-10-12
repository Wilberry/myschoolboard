"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SetupSnapshot } from "@/src/modules/academics/read-setup";

type Kind = "session" | "term" | "class" | "subject";

export function SchoolSetupEditor({
  schoolId,
  snapshot,
}: {
  schoolId: string;
  snapshot: SetupSnapshot;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, kind: Kind) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const sessionId = String(values.sessionId ?? "");
    delete values.sessionId;

    const route = {
      session: `academic/sessions`,
      term: `academic/sessions/${encodeURIComponent(sessionId)}/terms`,
      class: "classes",
      subject: "subjects",
    }[kind];

    const body: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(values)) {
      body[key] = key === "position" ? Number(value) : String(value);
    }

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/${route}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const message =
          response.status === 409
            ? "A matching record exists or conflicts with this configuration."
            : response.status === 401 || response.status === 404
              ? "Your session or school permissions no longer allow this change."
              : response.status === 400
                ? "Please check the entered values and dates."
                : "The change could not be saved. Try again.";
        setError(message);
        return;
      }
      form.reset();
      setSuccess("Saved successfully. The school workspace is refreshing.");
      router.refresh();
    } catch {
      setError("Network connection failed. No success has been confirmed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="setup-workspace">
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="setup-success" role="status">{success}</p>}
      <section className="setup-panel" aria-labelledby="sessions-title">
        <h2 id="sessions-title">Academic sessions</h2>
        <p>New sessions are planned until a future activation workflow is approved.</p>
        <form onSubmit={(event) => void submit(event, "session")}>
          <label>
            Session name
            <input name="name" required minLength={2} maxLength={120} placeholder="2026/2027" />
          </label>
          <label>
            Starts on
            <input name="startsOn" type="date" required />
          </label>
          <label>
            Ends on
            <input name="endsOn" type="date" required />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create session"}
          </button>
        </form>
        <ul className="setup-records">
          {snapshot.sessions.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.startsOn} – {item.endsOn} · {item.status}</span>
            </li>
          ))}
          {snapshot.sessions.length === 0 && <li>No sessions configured yet.</li>}
        </ul>
      </section>

      <section className="setup-panel" aria-labelledby="terms-title">
        <h2 id="terms-title">Terms</h2>
        <p>Terms must fit within their own academic session dates.</p>
        <form onSubmit={(event) => void submit(event, "term")}>
          <label>
            Academic session
            <select name="sessionId" required defaultValue="">
              <option value="" disabled>Choose a session</option>
              {snapshot.sessions.filter((item) => item.status !== "CLOSED").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Term name
            <input name="name" minLength={2} maxLength={120} required placeholder="First Term" />
          </label>
          <label>
            Term order
            <input name="position" type="number" min={1} max={8} required />
          </label>
          <label>
            Starts on
            <input name="startsOn" type="date" required />
          </label>
          <label>
            Ends on
            <input name="endsOn" type="date" required />
          </label>
          <button type="submit" disabled={pending || !snapshot.sessions.length}>
            {pending ? "Saving…" : "Create term"}
          </button>
        </form>
        <ul className="setup-records">
          {snapshot.terms.map((term) => (
            <li key={term.id}>
              <strong>{term.name} · Term {term.position}</strong>
              <span>{term.startsOn} – {term.endsOn} · {term.status}</span>
            </li>
          ))}
          {snapshot.terms.length === 0 && <li>No terms configured yet.</li>}
        </ul>
      </section>

      <section className="setup-panel" aria-labelledby="classes-title">
        <h2 id="classes-title">Classes</h2>
        <form onSubmit={(event) => void submit(event, "class")}>
          <label>
            Class name
            <input name="name" required minLength={2} maxLength={120} placeholder="Primary One" />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create class"}
          </button>
        </form>
        <ul className="setup-records">
          {snapshot.classes.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.isActive ? "Active" : "Inactive"}</span>
            </li>
          ))}
          {snapshot.classes.length === 0 && <li>No classes configured yet.</li>}
        </ul>
      </section>

      <section className="setup-panel" aria-labelledby="subjects-title">
        <h2 id="subjects-title">Subjects</h2>
        <form onSubmit={(event) => void submit(event, "subject")}>
          <label>
            Subject name
            <input name="name" required minLength={2} maxLength={120} placeholder="Mathematics" />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create subject"}
          </button>
        </form>
        <ul className="setup-records">
          {snapshot.subjects.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.isActive ? "Active" : "Inactive"}</span>
            </li>
          ))}
          {snapshot.subjects.length === 0 && <li>No subjects configured yet.</li>}
        </ul>
      </section>
      <p className="workspace-note">
        For each category, up to 100 records are shown. This view does not publish
        academic records or alter historical teacher assignments.
      </p>
    </div>
  );
}
