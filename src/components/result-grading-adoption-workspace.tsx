"use client";
import { useEffect, useState, type FormEvent } from "react";
type Policy = {
  id: string;
  sessionId: string;
  termId: string;
  classId: string;
  subjectId: string;
  version: number;
  quizWeight: number;
  testWeight: number;
  examWeight: number;
  reason: string;
};
type Adoption = {
  id: string;
  policyId: string;
  ordinal: number;
  policyVersion: number;
  reason: string;
};
export function ResultGradingAdoptionWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [history, setHistory] = useState<Adoption[]>([]);
  const [policyId, setPolicyId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`${root}/assessment-grading-policies`, { cache: "no-store" }),
      fetch(`${root}/result-grading-adoptions`, { cache: "no-store" }),
    ])
      .then(async ([p, a]) => {
        if (!p.ok || !a.ok) throw Error();
        return Promise.all([p.json(), a.json()]);
      })
      .then(([p, a]) => {
        if (live) {
          setPolicies(p.policies);
          setHistory(a.adoptions);
        }
      })
      .catch(() => {
        if (live) setMessage("School grading adoption history unavailable.");
      });
    return () => {
      live = false;
    };
  }, [root, reload]);
  async function adopt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !policyId || reason.trim().length < 5) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${root}/result-grading-adoptions`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, reason }),
      });
      if (!response.ok) throw Error();
      setMessage(
        "Grading revision adopted for academic preparation only. No marks or reports published.",
      );
      setReason("");
      setPolicyId("");
      setReload((v) => v + 1);
    } catch {
      setMessage("Adoption denied; policy may be inactive or already adopted.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="result-adoption-title">
      <h2 id="result-adoption-title">Adopt a grading-policy revision</h2>
      <p>
        School Super Admin only. An adoption records the exact policy version
        for a class, subject and period, but is not approval or publication of
        individual student results.
      </p>
      <form onSubmit={adopt}>
        <label htmlFor="result-adoption-policy">
          Versioned school grading draft
        </label>
        <select
          id="result-adoption-policy"
          value={policyId}
          required
          onChange={(e) => setPolicyId(e.target.value)}
        >
          <option value="">Choose grading revision</option>
          {policies
            .filter((p) => !history.some((a) => a.policyId === p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.classId} / {p.subjectId} / {p.termId} — v{p.version}— Quiz{" "}
                {p.quizWeight}%, Test {p.testWeight}%, Exam {p.examWeight}%
              </option>
            ))}
        </select>
        <label htmlFor="result-adoption-reason">Adoption reason (audit)</label>
        <textarea
          id="result-adoption-reason"
          minLength={5}
          maxLength={500}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !policyId || reason.trim().length < 5}
        >
          Adopt immutable grading policy (not publish)
        </button>
      </form>
      <h3>Adoption history</h3>
      <ul>
        {history.map((a) => (
          <li key={a.id}>
            Policy v{a.policyVersion}, adoption {a.ordinal}: {a.reason}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
