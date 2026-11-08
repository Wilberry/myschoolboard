"use client";
import { useRef, useState, type FormEvent } from "react";
export interface NoticeField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "datetime-local";
  options?: Array<{ value: string; label: string }>;
  value?: string;
  multiple?: boolean;
  values?: string[];
  required?: boolean;
  maxLength?: number;
}
export function NoticeActionForm({
  title,
  endpoint,
  fields,
  build,
  onSaved,
}: {
  title: string;
  endpoint: string;
  fields: NoticeField[];
  build: (f: FormData) => Record<string, unknown>;
  onSaved: () => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    let data: Record<string, unknown>;
    try {
      data = build(new FormData(form));
    } catch {
      setMessage("Check the required fields and try again.");
      return;
    }
    const fingerprint = JSON.stringify(data);
    if (!intent.current || intent.current.fingerprint !== fingerprint)
      intent.current = { fingerprint, key: crypto.randomUUID() };
    if (!window.confirm(`Confirm: ${title.toLowerCase()}?`)) return;
    setBusy(true);
    setMessage("Saving school communication action…");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, requestKey: intent.current.key }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error(r.status === 409 ? "conflict" : "denied");
      intent.current = null;
      form.reset();
      setMessage("Saved. The immutable school history is preserved.");
      onSaved();
    } catch (e) {
      setMessage(
        e instanceof Error && e.message === "conflict"
          ? "The version or request conflicts with current history. Recheck records before retrying."
          : "Unable to save. Recheck your access and details. Unchanged retries reuse the original request key.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="finance-form finance-controls"
      aria-label={title}
      onSubmit={(e) => void submit(e)}
    >
      <h3>{title}</h3>
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.type === "select" ? (
            <select
              name={f.name}
              defaultValue={f.multiple ? (f.values ?? []) : (f.value ?? "")}
              multiple={f.multiple}
              required={f.required ?? true}
            >
              <option value="">Select an option</option>
              {f.options?.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              name={f.name}
              required={f.required ?? true}
              maxLength={f.maxLength ?? 20000}
              rows={5}
              defaultValue={f.value}
            />
          ) : (
            <input
              name={f.name}
              type={f.type ?? "text"}
              step={f.type === "datetime-local" ? "any" : undefined}
              required={f.required ?? true}
              maxLength={f.maxLength ?? (f.name === "reason" ? 500 : 160)}
              defaultValue={f.value}
            />
          )}
        </label>
      ))}
      <button type="submit" disabled={busy}>
        {busy ? "Saving…" : title}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
