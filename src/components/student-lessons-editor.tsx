"use client";
import { useEffect, useState } from "react";
interface Lesson { id: string; topic: string; kind: "LESSON_NOTE" | "SCHEME_OF_WORK"; weekStart: number | null; weekEnd: number | null; subjectName: string;
  className: string; termName: string; revisionNumber: number;
  objectives?: string; content?: string }
export function StudentLessonsEditor({ schoolId }: { schoolId: string }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [active, setActive] = useState<Lesson | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/schools/${encodeURIComponent(schoolId)}/student-lessons`,
      { credentials: "same-origin", cache: "no-store" })
      .then(async response => { if (!response.ok) throw Error(); return response.json(); })
      .then(data => { if (live) setLessons(data.lessons); })
      .catch(() => { if (live) setMessage("No authorized lesson access is available."); });
    return () => { live = false; };
  }, [schoolId]);
  async function open(id: string) {
    if (working) return;
    setWorking(true); setActive(null);
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/student-lessons/${encodeURIComponent(id)}`,
        { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw Error();
      setActive((await response.json()).lesson);
    } catch { setMessage("Lesson was withdrawn, term closed or access revoked."); }
    finally { setWorking(false); }
  }
  return <section className="school-card" aria-labelledby="my-lessons">
    <h2 id="my-lessons">Released class lessons</h2>
    <p>Only lessons approved and explicitly released for your currently verified class and academic term appear here.</p>
    <ul>{lessons.map(item => <li key={item.id}>
      {item.kind === "SCHEME_OF_WORK" ? "Scheme of work" : "Lesson note"} · {item.subjectName}: {item.topic} — {item.className}, {item.termName}{item.weekStart ? ` · Weeks ${item.weekStart}–${item.weekEnd}` : ""}
      <button type="button" disabled={working} onClick={() => open(item.id)}>Open lesson</button>
    </li>)}</ul>
    {active && <article><h3>{active.topic}</h3>
      <h4>Learning objectives</h4><p style={{ whiteSpace: "pre-wrap" }}>{active.objectives}</p>
      <h4>Lesson content</h4><p style={{ whiteSpace: "pre-wrap" }}>{active.content}</p>
    </article>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
