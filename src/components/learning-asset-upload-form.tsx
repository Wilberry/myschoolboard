"use client";
import { useRef, useState, type FormEvent } from "react";
export function LearningAssetUploadForm({
  schoolId,
  entryId,
  revision,
  onSaved,
}: {
  schoolId: string;
  entryId: string;
  revision: number;
  onSaved: () => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = new FormData(form),
      file = data.get("file");
    if (
      !(file instanceof File) ||
      !["image/png", "image/jpeg"].includes(file.type) ||
      !file.size ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage("Choose a PNG or JPEG up to 5 MiB.");
      return;
    }
    setBusy(true);
    try {
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const fingerprint = JSON.stringify([
        entryId,
        revision,
        digest,
        file.type,
        data.get("reason"),
      ]);
      if (intent.current?.fingerprint !== fingerprint)
        intent.current = { fingerprint, key: crypto.randomUUID() };
      data.set("requestKey", intent.current!.key);
      data.set("expectedRevision", String(revision));
      if (
        !window.confirm(
          "Upload this image for private inspection and independent rights review?",
        )
      )
        return;
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/library/catalog/${entryId}/assets`,
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
        "Upload recorded. Inspection, rights approval and release are separate.",
      );
      onSaved();
    } catch {
      setMessage(
        "Unable to complete upload. Recheck access and retry; unchanged retries keep their original request key.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="finance-form finance-controls"
      aria-label="Upload private learning image"
      onSubmit={(e) => void upload(e)}
    >
      <h3>Propose a private learning image</h3>
      <p>
        Use only material you are authorized to provide. Uploading does not
        publish it.
      </p>
      <label>
        PNG or JPEG (up to 5 MiB)
        <input type="file" name="file" accept="image/png,image/jpeg" required />
      </label>
      <label>
        Upload reason
        <input name="reason" minLength={5} maxLength={500} required />
      </label>
      <button disabled={busy} type="submit">
        {busy ? "Uploading…" : "Upload for inspection"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
