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

  async function transition(
    event: FormEvent<HTMLFormElement>,
    sessionId: string,
    status: "ACTIVE" | "CLOSED",
    termId?: string,
  ) {
    event.preventDefault();
    if (pending) return;
    if (
      status === "CLOSED" &&
      !window.confirm("Close this academic period? It cannot be reopened.")
    ) {
      return;
    }
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") ?? "").trim();
    setPending(true);
    setError(null);
    setSuccess(null);
    const route = termId
      ? `academic/sessions/${encodeURIComponent(sessionId)}/terms/${encodeURIComponent(termId)}/status`
      : `academic/sessions/${encodeURIComponent(sessionId)}/status`;
    try {
      const result = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/${route}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reason }),
          cache: "no-store",
        },
      );
      if (!result.ok) {
        setError(
          result.status === 409
            ? "This period cannot be changed yet. Close active and planned terms before closing its session."
            : result.status === 401 || result.status === 404
              ? "Your session or school permissions no longer allow this change."
              : result.status === 400
                ? "Provide a reason of at least five characters."
                : "The period could not be changed.",
        );
        return;
      }
      setSuccess("Academic period updated and audit record saved.");
      router.refresh();
    } catch {
      setError(
        "Network connection failed. No status change has been confirmed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function submitSection(
    event: FormEvent<HTMLFormElement>,
    operation: "create" | "assign",
  ) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const classId = String(values.get("classId") ?? "");
    const sectionId = String(values.get("sectionId") ?? "");
    const reason = String(values.get("reason") ?? "").trim();
    setPending(true);
    setError(null);
    setSuccess(null);
    const route =
      operation === "create"
        ? `sections`
        : `classes/${encodeURIComponent(classId)}/section`;
    const body =
      operation === "create"
        ? {
            name: String(values.get("name") ?? "").trim(),
            stage: String(values.get("stage") ?? ""),
            reason,
          }
        : { sectionId, reason };
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/${route}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 409
            ? "The section name already exists or the class has already been classified."
            : response.status === 400
              ? "Check the section and justification entered."
              : response.status === 401 || response.status === 404
                ? "The school, section, class or your permission is no longer active."
                : "Could not save this section configuration.",
        );
        return;
      }
      form.reset();
      setSuccess(
        operation === "create"
          ? "Section created. The configuration is refreshing."
          : "Class assigned to a section with an audit record.",
      );
      router.refresh();
    } catch {
      setError("Network connection failed. No change has been confirmed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="setup-workspace">
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
      <section className="setup-panel" aria-labelledby="sessions-title">
        <h2 id="sessions-title">Academic sessions</h2>
        <p>
          New sessions are planned until a future activation workflow is
          approved.
        </p>
        <form onSubmit={(event) => void submit(event, "session")}>
          <label>
            Session name
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder="2026/2027"
            />
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
              <span>
                {item.startsOn} – {item.endsOn} · {item.status}
              </span>
              {item.status !== "CLOSED" && (
                <form
                  className="setup-status-form"
                  onSubmit={(event) =>
                    void transition(
                      event,
                      item.id,
                      item.status === "PLANNED" ? "ACTIVE" : "CLOSED",
                    )
                  }
                >
                  <label>
                    Reason
                    <input
                      name="reason"
                      minLength={5}
                      maxLength={500}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      pending ||
                      (item.status === "ACTIVE" &&
                        snapshot.terms.some(
                          (term) =>
                            term.sessionId === item.id &&
                            term.status !== "CLOSED",
                        ))
                    }
                  >
                    {item.status === "PLANNED"
                      ? "Activate session"
                      : "Close session"}
                  </button>
                </form>
              )}
            </li>
          ))}
          {snapshot.sessions.length === 0 && (
            <li>No sessions configured yet.</li>
          )}
        </ul>
      </section>

      <section className="setup-panel" aria-labelledby="terms-title">
        <h2 id="terms-title">Terms</h2>
        <p>Terms must fit within their own academic session dates.</p>
        <form onSubmit={(event) => void submit(event, "term")}>
          <label>
            Academic session
            <select name="sessionId" required defaultValue="">
              <option value="" disabled>
                Choose a session
              </option>
              {snapshot.sessions
                .filter((item) => item.status !== "CLOSED")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Term name
            <input
              name="name"
              minLength={2}
              maxLength={120}
              required
              placeholder="First Term"
            />
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
              <strong>
                {term.name} · Term {term.position}
              </strong>
              <span>
                {term.startsOn} – {term.endsOn} · {term.status}
              </span>
              {term.status !== "CLOSED" && (
                <form
                  className="setup-status-form"
                  onSubmit={(event) =>
                    void transition(
                      event,
                      term.sessionId,
                      term.status === "PLANNED" ? "ACTIVE" : "CLOSED",
                      term.id,
                    )
                  }
                >
                  <label>
                    Reason
                    <input
                      name="reason"
                      minLength={5}
                      maxLength={500}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      pending ||
                      (term.status === "PLANNED" &&
                        !snapshot.sessions.some(
                          (session) =>
                            session.id === term.sessionId &&
                            session.status === "ACTIVE",
                        ))
                    }
                  >
                    {term.status === "PLANNED" ? "Activate term" : "Close term"}
                  </button>
                </form>
              )}
            </li>
          ))}
          {snapshot.terms.length === 0 && <li>No terms configured yet.</li>}
        </ul>
      </section>

      <section className="setup-panel" aria-labelledby="sections-title">
        <h2 id="sections-title">Primary and secondary sections</h2>
        <p>
          Sections are school-owned. Existing classes remain unclassified until
          assigned.
        </p>
        <form onSubmit={(event) => void submitSection(event, "create")}>
          <label>
            Section name
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder="Primary Department"
            />
          </label>
          <label>
            Education stage
            <select name="stage" required defaultValue="PRIMARY">
              <option value="PRIMARY">Primary</option>
              <option value="SECONDARY">Secondary</option>
            </select>
          </label>
          <label>
            Reason
            <input name="reason" required minLength={5} maxLength={500} />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create section"}
          </button>
        </form>
        <ul className="setup-records">
          {snapshot.sections.map((section) => (
            <li key={section.id}>
              <strong>{section.name}</strong>
              <span>
                {section.stage} · {section.isActive ? "Active" : "Inactive"}
              </span>
            </li>
          ))}
          {snapshot.sections.length === 0 && (
            <li>No sections configured yet.</li>
          )}
        </ul>
      </section>

      <section className="setup-panel" aria-labelledby="class-section-title">
        <h2 id="class-section-title">Class section placement</h2>
        <p>
          A class can be placed once. Moving it later requires a separate
          reviewed transfer workflow.
        </p>
        <form onSubmit={(event) => void submitSection(event, "assign")}>
          <label>
            Unclassified class
            <select name="classId" required defaultValue="">
              <option value="" disabled>
                Choose a class
              </option>
              {snapshot.classes
                .filter((item) => item.isActive && !item.sectionId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Active section
            <select name="sectionId" required defaultValue="">
              <option value="" disabled>
                Choose a section
              </option>
              {snapshot.sections
                .filter((item) => item.isActive)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.stage})
                  </option>
                ))}
            </select>
          </label>
          <label>
            Placement reason
            <input name="reason" minLength={5} maxLength={500} required />
          </label>
          <button
            type="submit"
            disabled={
              pending ||
              !snapshot.sections.some((item) => item.isActive) ||
              !snapshot.classes.some((item) => item.isActive && !item.sectionId)
            }
          >
            {pending ? "Saving…" : "Assign class to section"}
          </button>
        </form>
      </section>

      <section className="setup-panel" aria-labelledby="classes-title">
        <h2 id="classes-title">Classes</h2>
        <form onSubmit={(event) => void submit(event, "class")}>
          <label>
            Class name
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder="Primary One"
            />
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
              <span>
                Section:{" "}
                {snapshot.sections.find(
                  (section) => section.id === item.sectionId,
                )?.name ?? "Unclassified"}
              </span>
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
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder="Mathematics"
            />
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
          {snapshot.subjects.length === 0 && (
            <li>No subjects configured yet.</li>
          )}
        </ul>
      </section>
      <p className="workspace-note">
        For each category, up to 100 records are shown. This view does not
        publish academic records or alter historical teacher assignments.
      </p>
    </div>
  );
}
