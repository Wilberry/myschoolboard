"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
interface PolicyValue {
  timeZone: string;
  submissionBackdateDays: number;
  correctionWindowDays: number;
  revision: number;
  createdAt: Date | string | null;
}

export function AttendancePolicyEditor({
  schoolId,
  current,
}: {
  schoolId: string;
  current: PolicyValue;
}) {
  const router = useRouter();
  const [zone, setZone] = useState(current.timeZone);
  const [submitDays, setSubmitDays] = useState(current.submissionBackdateDays);
  const [correctionDays, setCorrectionDays] = useState(
    current.correctionWindowDays,
  );
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const result = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/attendance-policy`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeZone: zone,
            submissionBackdateDays: submitDays,
            correctionWindowDays: correctionDays,
            reason,
          }),
        },
      );
      if (!result.ok) {
        setMessage(
          result.status === 400
            ? "Check the timezone, policy limits, and reason."
            : result.status === 409
              ? "The policy changed. Refresh before retrying."
              : "Change unavailable or school administration access revoked.",
        );
        return;
      }
      setReason("");
      setMessage("New attendance policy revision saved.");
      router.refresh();
    } catch {
      setMessage("Request failed. No policy change was confirmed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="school-card"
      aria-labelledby="attendance-policy-heading"
    >
      <h2 id="attendance-policy-heading">Versioned school policy</h2>
      <p>
        Current revision: {current.revision} · Timezone: {current.timeZone}
      </p>
      <form onSubmit={save}>
        <label htmlFor="attendance-zone">IANA timezone</label>
        <input
          id="attendance-zone"
          list="attendance-zones"
          required
          value={zone}
          maxLength={64}
          onChange={(event) => setZone(event.target.value)}
        />
        <datalist id="attendance-zones">
          <option value="Etc/UTC" />
          <option value="Africa/Lagos" />
          <option value="Africa/Accra" />
          <option value="Africa/Nairobi" />
          <option value="Europe/London" />
          <option value="America/New_York" />
        </datalist>
        <label htmlFor="attendance-submit-days">
          Allowed previous calendar days for attendance (0–30)
        </label>
        <input
          id="attendance-submit-days"
          type="number"
          min={0}
          max={30}
          step={1}
          required
          value={submitDays}
          onChange={(event) => setSubmitDays(Number(event.target.value))}
        />
        <label htmlFor="attendance-correction-days">
          Correction window in calendar days (0–365)
        </label>
        <input
          id="attendance-correction-days"
          type="number"
          min={0}
          max={365}
          step={1}
          required
          value={correctionDays}
          onChange={(event) => setCorrectionDays(Number(event.target.value))}
        />
        <label htmlFor="attendance-policy-reason">
          Reason for changing policy (5–500 characters)
        </label>
        <textarea
          id="attendance-policy-reason"
          required
          minLength={5}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <button disabled={pending || reason.trim().length < 5} type="submit">
          {pending ? "Recording…" : "Save new audited policy revision"}
        </button>
        <p role="status" aria-live="polite">
          {message}
        </p>
      </form>
    </section>
  );
}
