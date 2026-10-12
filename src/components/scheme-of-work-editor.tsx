"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";

interface Week { week: number; topic: string; objectives: string; activities: string }
interface Scheme {
  id: string; topic: string; kind: "LESSON_NOTE" | "SCHEME_OF_WORK";
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";
  currentRevision: number; termId: string; assignmentId: string;
  revisions?: Array<{
    revisionNumber: number; topic: string; objectives: string;
    content: string; weeklyPlan: Week[] | null;
  }>;
}
const fresh = (): Week => ({
  week: 1, topic: "", objectives: "", activities: "",
});

export function SchemeOfWorkEditor({
  schoolId, options,
}: { schoolId: string; options: LessonWritingOptions }) {
  const base = `/api/schools/${encodeURIComponent(schoolId)}/lesson-notes`;
  const [termId, setTermId] = useState("");
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selected, setSelected] = useState<Scheme | null>(null);
  const [title, setTitle] = useState("");
  const [objectives, setObjectives] = useState("");
  const [content, setContent] = useState("");
  const [weeks, setWeeks] = useState<Week[]>([fresh()]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [revisionMode, setRevisionMode] = useState(false);
  const permittedAssignments = options.assignments.filter(item =>
    item.sessionId === options.terms.find(term => term.id === termId)?.sessionId);
  const planValid = weeks.length > 0 && weeks.length <= 24 &&
    weeks.every((row, index) =>
      row.week >= 1 && row.week <= 24 &&
      (index === 0 || row.week > weeks[index - 1].week) &&
      row.topic.trim().length >= 2 &&
      row.objectives.trim().length >= 5 &&
      row.activities.trim().length >= 5);

  async function list() {
    const response = await fetch(base, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error("Unavailable");
    const data = await response.json() as { notes: Scheme[] };
    setSchemes(data.notes.filter(note => note.kind === "SCHEME_OF_WORK"));
  }
  useEffect(() => {
    let active = true;
    fetch(base, { cache: "no-store", credentials: "same-origin" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: { notes: Scheme[] }) => {
        if (active) setSchemes(data.notes.filter(note => note.kind === "SCHEME_OF_WORK"));
      })
      .catch(() => { if (active) setNotice("Scheme list unavailable or assignment revoked."); });
    return () => { active = false; };
  }, [base]);

  function updateWeek(index: number, field: keyof Week, value: string | number) {
    setWeeks(old => old.map((row, i) =>
      i === index ? { ...row, [field]: value } : row));
  }

  async function post(path: string, body: object) {
    const response = await fetch(path, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!response.ok) {
      setNotice(response.status === 409 ? "Scheme changed or a scheme already exists for this assignment/term."
        : "Scheme rejected. Recheck current assignment, content, weeks and review state.");
      return false;
    }
    return true;
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !planValid || title.trim().length < 2 ||
        objectives.trim().length < 5 || content.trim().length < 10) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      topic: title, objectives, content,
      weeklyPlan: weeks.map(({ week, topic, objectives, activities }) => ({
        week, topic, objectives, activities,
      })),
    };
    setBusy(true); setNotice("");
    try {
      const ok = revisionMode && selected
        ? await post(`${base}/${encodeURIComponent(selected.id)}/revisions`, {
            ...payload, expectedRevision: selected.currentRevision,
          })
        : await post(base, {
            ...payload, kind: "SCHEME_OF_WORK",
            termId: String(form.get("termId") ?? ""),
            assignmentId: String(form.get("assignmentId") ?? ""),
          });
      if (!ok) return;
      setNotice("New immutable scheme revision saved. Approval and release remain separate.");
      await list();
      setSelected(null); setRevisionMode(false);
      setTitle(""); setObjectives(""); setContent(""); setWeeks([fresh()]);
    } catch { setNotice("Network failure. Saving was not confirmed."); }
    finally { setBusy(false); }
  }

  async function openScheme(id: string) {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      const res = await fetch(`${base}/${encodeURIComponent(id)}`,
        { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error();
      const note = (await res.json() as { note: Scheme }).note;
      if (note.kind !== "SCHEME_OF_WORK") throw new Error();
      setSelected(note); setRevisionMode(false);
    } catch {
      setSelected(null); setNotice("Scheme unavailable or assignment no longer active.");
    } finally { setBusy(false); }
  }

  function startRevision() {
    if (!selected || !selected.revisions?.length) return;
    const latest = selected.revisions[0];
    if (!Array.isArray(latest.weeklyPlan)) return;
    setTitle(latest.topic); setObjectives(latest.objectives);
    setContent(latest.content);
    setWeeks(latest.weeklyPlan.map(row => ({ ...row })));
    setRevisionMode(true);
  }

  async function submitScheme() {
    if (!selected || selected.status !== "DRAFT" || busy) return;
    if (!window.confirm("Submit the exact current scheme revision for section approval?")) return;
    setBusy(true); setNotice("");
    try {
      const ok = await post(`${base}/${encodeURIComponent(selected.id)}/submit`, {
        expectedRevision: selected.currentRevision,
      });
      if (!ok) return;
      setNotice("Submitted. This scheme is NOT yet approved or released.");
      setSelected(null); await list();
    } catch { setNotice("Submission could not be confirmed."); }
    finally { setBusy(false); }
  }

  return <div className="setup-workspace">
    <section className="setup-panel" aria-labelledby="new-scheme-heading">
      <h2 id="new-scheme-heading">{revisionMode ? "Revise scheme" : "Create a term scheme of work"}</h2>
      <p>Plans belong to one exact current term, class, subject and active teacher assignment. Each revision preserves previous weeks.</p>
      <form onSubmit={save}>
        {!revisionMode && <>
          <label htmlFor="scheme-term">Academic term</label>
          <select id="scheme-term" name="termId" required value={termId}
            onChange={e => setTermId(e.target.value)}>
            <option value="">Select term</option>
            {options.terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label htmlFor="scheme-assignment">Exact teaching assignment</label>
          <select id="scheme-assignment" name="assignmentId" required key={termId} defaultValue="">
            <option value="">Select class and subject</option>
            {permittedAssignments.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </>}
        <label htmlFor="scheme-title">Scheme title</label>
        <input id="scheme-title" required minLength={2} maxLength={180}
          value={title} onChange={e => setTitle(e.target.value)} />
        <label htmlFor="scheme-objectives">Term learning outcomes</label>
        <textarea id="scheme-objectives" required minLength={5} maxLength={4000}
          value={objectives} onChange={e => setObjectives(e.target.value)} />
        <label htmlFor="scheme-overview">Term overview</label>
        <textarea id="scheme-overview" required minLength={10} maxLength={20000}
          value={content} onChange={e => setContent(e.target.value)} />
        <h3>Week-by-week topics</h3>
        {weeks.map((row, i) => <fieldset key={i}>
          <legend>Week entry {i + 1}</legend>
          <label>Week number (1–24)
            <input type="number" min={1} max={24} step={1} required value={row.week}
              onChange={e => updateWeek(i, "week", Number(e.target.value))} />
          </label>
          <label>Topic
            <input required minLength={2} maxLength={180} value={row.topic}
              onChange={e => updateWeek(i, "topic", e.target.value)} />
          </label>
          <label>Objectives
            <textarea required minLength={5} maxLength={4000} value={row.objectives}
              onChange={e => updateWeek(i, "objectives", e.target.value)} />
          </label>
          <label>Activities
            <textarea required minLength={5} maxLength={4000} value={row.activities}
              onChange={e => updateWeek(i, "activities", e.target.value)} />
          </label>
          {weeks.length > 1 && <button type="button" disabled={busy}
            onClick={() => setWeeks(old => old.filter((_, index) => index !== i))}>
            Remove week entry
          </button>}
        </fieldset>)}
        <button type="button" disabled={busy || weeks.length >= 24}
          onClick={() => setWeeks(old => [...old, { ...fresh(), week: old[old.length - 1].week + 1 }])}>
          Add week entry
        </button>
        <button type="submit" disabled={busy || !planValid}>
          Save {revisionMode ? "new revision" : "scheme draft"}
        </button>
      </form>
    </section>
    <section className="setup-panel">
      <h2>My schemes and immutable review history</h2>
      <ul>{schemes.map(scheme => <li key={scheme.id}>
        {scheme.topic} · {scheme.status} · Revision {scheme.currentRevision}
        <button type="button" disabled={busy} onClick={() => openScheme(scheme.id)}>
          Open scheme
        </button>
      </li>)}</ul>
    </section>
    {selected && <section className="setup-panel">
      <h3>{selected.topic} — {selected.status}</h3>
      {selected.revisions?.map(rev => <section key={rev.revisionNumber}>
        <h4>Revision {rev.revisionNumber}</h4>
        <p>{rev.content}</p>
        <ol>{rev.weeklyPlan?.map(week => <li key={week.week}>
          Week {week.week}: {week.topic} — {week.objectives} — {week.activities}
        </li>)}</ol>
      </section>)}
      {(selected.status === "DRAFT" || selected.status === "RETURNED") &&
        <button type="button" disabled={busy} onClick={startRevision}>Create new revision</button>}
      {selected.status === "DRAFT" &&
        <button type="button" disabled={busy} onClick={submitScheme}>Submit for approval</button>}
    </section>}
    <p role="status" aria-live="polite">{notice}</p>
  </div>;
}
