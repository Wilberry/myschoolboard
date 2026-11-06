"use client";
import { useRef, useState, type FormEvent } from "react";
export function PaymentImageForm({
  schoolId,
  claims,
  onSaved,
}: {
  schoolId: string;
  claims: Array<{ value: string; label: string }>;
  onSaved: () => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = new FormData(form),
      file = data.get("file"),
      evidenceId = data.get("evidenceId");
    if (
      !(file instanceof File) ||
      typeof evidenceId !== "string" ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage("Choose a PNG or JPEG image up to 5 MB.");
      return;
    }
    setBusy(true);
    setMessage("Inspecting and privately storing evidence…");
    try {
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const fingerprint = evidenceId + ":" + digest;
      if (!intent.current || intent.current.fingerprint !== fingerprint)
        intent.current = { fingerprint, key: crypto.randomUUID() };
      data.set("requestKey", intent.current.key);
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/payment-evidence-attachments`,
        {
          method: "POST",
          credentials: "same-origin",
          body: data,
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) throw Error();
      intent.current = null;
      form.reset();
      setMessage(
        "Evidence stored. The claim still requires independent bank verification.",
      );
      onSaved();
    } catch {
      setMessage(
        "Upload unavailable. Check your access and use a valid PNG/JPEG image up to 4096 pixels per side and 5 MB. An unchanged retry keeps its original request key.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="finance-form finance-controls"
      aria-label="Attach payment evidence image"
      onSubmit={(e) => void submit(e)}
    >
      <h3>Attach payment evidence image</h3>
      <label>
        Pending claim
        <select name="evidenceId" required defaultValue="">
          <option value="">Select a claim</option>
          {claims.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Transfer evidence (PNG or JPEG, up to 5 MB)
        <input name="file" type="file" accept="image/png,image/jpeg" required />
      </label>
      <button disabled={busy} type="submit">
        Attach payment evidence image
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
