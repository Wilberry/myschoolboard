"use client";
import { useEffect, useState } from "react";

interface Draft {
  id: string; title: string; kind: "QUIZ" | "TEST" | "EXAM";
  className: string; subjectName: string; sectionName: string;
  termName: string; questionCount: number; maxScore: number;
  durationMinutes: number; maxAttempts: number; passPercent: number;
}
interface Item {
  questionId: string; position: number; points: number;
  prompt: string; options: string[];
}
export function AssessmentReviewEditor({ schoolId }: { schoolId: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Item[]>([]);
  const [decision, setDecision] = useState<"APPROVED" | "RETURNED">("RETURNED");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/schools/${encodeURIComponent(schoolId)}/assessment-reviews`,
      { cache: "no-store", credentials: "same-origin" })
      .then(async r => { if (!r.ok) throw Error(); return r.json(); })
      .then(r => { if (active) { setDrafts(r.drafts); setSelected(null); } })
      .catch(() => { if (active) { setDrafts([]); setMessage("Review access is unavailable."); } });
    return () => { active = false; };
  }, [schoolId, refresh]);
  async function inspect(draft: Draft) {
    if (busy) return;
    setBusy(true); setSelected(null); setPreview([]); setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-reviews/${encodeURIComponent(draft.id)}`,
        { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw Error();
      const payload = await response.json() as { items: Item[] };
      if (!payload.items.length) throw Error();
      setPreview(payload.items); setSelected(draft);
      setReason(""); setConfirmed(false);
    } catch {
      setMessage("Question preview unavailable. Section permission or draft may have changed.");
    } finally { setBusy(false); }
  }
  async function save() {
    if (busy || !selected || !confirmed || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/assessment-reviews/${encodeURIComponent(selected.id)}/decision`,
        { method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, reason }),
        });
      setMessage(response.ok
        ? "Immutable review decision recorded. Exam remains unavailable to students."
        : "Decision rejected. Draft or section permissions may have changed.");
      setSelected(null); setReason(""); setConfirmed(false);
      setRefresh(v => v + 1);
    } catch {
      setMessage("Request failed; no approval was confirmed.");
    } finally { setBusy(false); }
  }
  return <section className="school-card" aria-labelledby="assessment-review-title">
    <h2 id="assessment-review-title">Assessment moderation (not publication)</h2>
    <p>Review only drafts within your verified section. Approving a draft does not make questions or answers available to students.</p>
    <button type="button" onClick={() => setRefresh(v => v + 1)}
      disabled={busy}>Refresh review queue</button>
    <ul>{drafts.map(d => <li key={d.id}>
      <strong>{d.kind}: {d.title}</strong> — {d.className}, {d.subjectName} ·
      {d.sectionName}, {d.termName} · {d.questionCount} questions ·
      {d.maxScore} marks · {d.durationMinutes} minutes
      <button type="button" disabled={busy}
        onClick={() => { void inspect(d); }}>
        Review draft
      </button>
    </li>)}</ul>
    {selected && <section aria-label="Assessment review decision">
      <h3>{selected.title} — {selected.className}</h3>
      <p>Attempt limit {selected.maxAttempts}. Passing threshold {selected.passPercent}%.</p>
      <h4>Private draft questions (correct answers hidden)</h4>
      <ol>{preview.map(item => <li key={item.questionId}>
        <strong>{item.prompt}</strong> · {item.points} marks
        <ol>{item.options.map((option, index) =>
          <li key={index}>{option}</li>)}</ol>
      </li>)}</ol>
      <label htmlFor="review-decision">Decision</label>
      <select id="review-decision" value={decision}
        onChange={e => setDecision(e.target.value as "APPROVED" | "RETURNED")}>
        <option value="RETURNED">Return for a new draft</option>
        <option value="APPROVED">Approve this immutable configuration</option>
      </select>
      <label htmlFor="review-reason">Reason (minimum 5 characters)</label>
      <textarea id="review-reason" minLength={5} maxLength={500} required
        value={reason} onChange={e => setReason(e.target.value)} />
      <label><input type="checkbox" checked={confirmed}
        onChange={e => setConfirmed(e.target.checked)} />
        I have inspected the question content, class, subject, section, timing and limits.</label>
      <button type="button" disabled={busy || !confirmed || preview.length === 0 || reason.trim().length < 5}
        onClick={save}>Record irreversible review decision</button>
    </section>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
