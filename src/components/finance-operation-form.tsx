"use client";
import { useRef, useState, type FormEvent } from "react";
export interface FinanceField {
  name: string;
  label: string;
  type?: "text" | "select" | "checkbox";
  options?: Array<{ value: string; label: string }>;
  pattern?: string;
}
export function FinanceOperationForm({
  title,
  endpoint,
  fields,
  build,
  onSaved,
  requestKey = true,
}: {
  title: string;
  endpoint: string;
  fields: FinanceField[];
  build: (data: FormData) => Record<string, unknown>;
  onSaved: () => void;
  requestKey?: boolean;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    let data: Record<string, unknown>;
    try {
      data = build(new FormData(form));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Enter valid financial details.",
      );
      return;
    }
    const fingerprint = JSON.stringify(data);
    if (!intent.current || intent.current.fingerprint !== fingerprint)
      intent.current = { fingerprint, key: crypto.randomUUID() };
    if (!window.confirm(`Confirm: ${title.toLowerCase()}?`)) return;
    setBusy(true);
    setMessage("Saving decision…");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          requestKey ? { ...data, requestKey: intent.current.key } : data,
        ),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw Error(response.status === 409 ? "conflict" : "denied");
      intent.current = null;
      form.reset();
      setMessage("Saved. The financial history is preserved.");
      onSaved();
    } catch (e) {
      setMessage(
        e instanceof Error && e.message === "conflict"
          ? "This request conflicts with existing financial evidence. Recheck current records."
          : "Unable to save. Recheck your access and financial evidence; retrying unchanged input keeps the same request key.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="finance-form finance-controls"
      aria-label={title}
      onSubmit={(event) => void submit(event)}
    >
      <h3>{title}</h3>
      {fields.map((field) => (
        <label key={field.name}>
          {field.label}
          {field.type === "select" ? (
            <select name={field.name} required defaultValue="">
              <option value="">Select an option</option>
              {field.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : field.type === "checkbox" ? (
            <input name={field.name} type="checkbox" required />
          ) : (
            <input
              name={field.name}
              type="text"
              required
              maxLength={field.name === "reason" ? 500 : 128}
              pattern={field.pattern}
              autoComplete="off"
            />
          )}
        </label>
      ))}
      <button disabled={busy} type="submit">
        {title}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
