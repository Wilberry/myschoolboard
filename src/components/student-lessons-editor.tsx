"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Lesson {
  id: string;
  topic: string;
  kind: "LESSON_NOTE" | "SCHEME_OF_WORK";
  weekStart: number | null;
  weekEnd: number | null;
  subjectName: string;
  className: string;
  termName: string;
  revisionNumber: number;
  objectives?: string;
  content?: string;
}

// Bound the time a still-open tab can show content after server-side revocation.
// Browser timers can be suspended, so visibility/focus/pageshow must also
// synchronously hide the previously rendered content before a fresh API read.
const RECHECK_MS = 10_000;
const REQUEST_TIMEOUT_MS = 5_000;
const accessDenied = "No authorized lesson access is available.";

export function StudentLessonsEditor({ schoolId }: { schoolId: string }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [active, setActive] = useState<Lesson | null>(null);
  const [message, setMessage] = useState("Checking lesson access…");
  const [working, setWorking] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const epoch = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const selectedId = useRef<string | null>(null);
  // Printing is allowed only after a fresh server-authorized detail check.
  const printGrantUntil = useRef(0);
  const privatePanel = useRef<HTMLDivElement | null>(null);
  const listUrl =
    "/api/schools/" + encodeURIComponent(schoolId) + "/student-lessons";

  const redact = useCallback(() => {
    epoch.current += 1;
    pending.current?.abort();
    selectedId.current = null;
    printGrantUntil.current = 0;
    // Synchronous concealment protects BFCache restores before React commits.
    if (privatePanel.current) privatePanel.current.hidden = true;
    setAuthorized(false);
    setLessons([]);
    setActive(null);
    setWorking(false);
    setMessage("Checking lesson access…");
  }, []);

  const revalidate = useCallback(
    async (concealFirst: boolean) => {
      const sequence = ++epoch.current;
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      if (concealFirst) {
        selectedId.current = null;
        printGrantUntil.current = 0;
        if (privatePanel.current) privatePanel.current.hidden = true;
        setAuthorized(false);
        setLessons([]);
        setActive(null);
        setMessage("Checking lesson access…");
      }
      setWorking(false);

      // A hung request must not leave a revoked lesson visible indefinitely.
      const deadline = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );
      try {
        const response = await fetch(listUrl, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw Error("Access denied");
        const payload = (await response.json()) as { lessons?: Lesson[] };
        if (!Array.isArray(payload.lessons)) throw Error("Invalid response");
        if (sequence !== epoch.current || controller.signal.aborted) return;

        const id = selectedId.current;
        let verifiedDetail: Lesson | null = null;
        if (id && payload.lessons.some((item) => item.id === id)) {
          const detail = await fetch(
            listUrl + "/" + encodeURIComponent(id),
            {
              credentials: "same-origin",
              cache: "no-store",
              signal: controller.signal,
            },
          );
          if (!detail.ok) throw Error("Lesson unavailable");
          const result = (await detail.json()) as { lesson?: Lesson };
          if (!result.lesson || result.lesson.id !== id) {
            throw Error("Invalid lesson");
          }
          verifiedDetail = result.lesson;
        } else {
          selectedId.current = null;
        }

        if (sequence !== epoch.current || controller.signal.aborted) return;
        setLessons(payload.lessons);
        setActive(verifiedDetail);
        setMessage("");
        setAuthorized(true);
        if (privatePanel.current) privatePanel.current.hidden = false;
      } catch {
        if (sequence !== epoch.current) return;
        selectedId.current = null;
        if (privatePanel.current) privatePanel.current.hidden = true;
        setAuthorized(false);
        setLessons([]);
        setActive(null);
        setMessage(accessDenied);
      } finally {
        window.clearTimeout(deadline);
        if (pending.current === controller) pending.current = null;
      }
    },
    [listUrl],
  );

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") redact();
      else void revalidate(true);
    };
    const handleFocus = () => {
      if (printGrantUntil.current > Date.now()) return;
      if (document.visibilityState === "visible") void revalidate(true);
    };
    const handlePageHide = () => redact();
    const handleBlur = () => {
      // Opening the browser's print dialog may blur the document.
      if (printGrantUntil.current > Date.now()) return;
      redact();
    };
    const handleBeforePrint = () => {
      // Native Ctrl+P cannot rely on previously cached permission.
      if (printGrantUntil.current <= Date.now()) redact();
    };
    const handleAfterPrint = () => {
      printGrantUntil.current = 0;
      redact();
      if (document.visibilityState === "visible") void revalidate(true);
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void revalidate(false);
    }, RECHECK_MS);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pageshow", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    void revalidate(true);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pageshow", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      epoch.current += 1;
      pending.current?.abort();
    };
  }, [redact, revalidate]);

  async function open(id: string) {
    if (working || !authorized || document.visibilityState !== "visible") {
      return;
    }
    const sequence = ++epoch.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    selectedId.current = null;
    setWorking(true);
    setActive(null);
    setMessage("");
    const deadline = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    try {
      const response = await fetch(listUrl + "/" + encodeURIComponent(id), {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw Error("Access denied");
      const payload = (await response.json()) as { lesson?: Lesson };
      if (!payload.lesson || payload.lesson.id !== id) {
        throw Error("Invalid lesson");
      }
      if (sequence !== epoch.current || controller.signal.aborted) return;
      selectedId.current = id;
      setActive(payload.lesson);
    } catch {
      if (sequence !== epoch.current) return;
      selectedId.current = null;
      if (privatePanel.current) privatePanel.current.hidden = true;
      setAuthorized(false);
      setLessons([]);
      setActive(null);
      setMessage("Lesson was withdrawn, term closed or access revoked.");
    } finally {
      window.clearTimeout(deadline);
      if (pending.current === controller) pending.current = null;
      if (sequence === epoch.current) setWorking(false);
    }
  }

  async function printLesson() {
    if (!active || working || !authorized) return;
    const lesson = active;
    const sequence = ++epoch.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setWorking(true);
    const deadline = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    try {
      // Print only the exact lesson contents most recently authorized.
      // If its revision changed, clear old text and require a fresh open.
      const response = await fetch(
        listUrl + "/" + encodeURIComponent(lesson.id),
        {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        },
      );
      if (!response.ok) throw Error("Access denied");
      const payload = (await response.json()) as { lesson?: Lesson };
      if (sequence !== epoch.current || controller.signal.aborted) return;
      const fresh = payload.lesson;
      if (
        !fresh ||
        fresh.id !== lesson.id ||
        fresh.revisionNumber !== lesson.revisionNumber ||
        fresh.content !== lesson.content ||
        fresh.objectives !== lesson.objectives
      ) {
        redact();
        setMessage("Lesson changed. Open it again before printing.");
        return;
      }
      const grant = Date.now() + REQUEST_TIMEOUT_MS;
      printGrantUntil.current = grant;
      // This explicit print action preserves authorized content across the
      // browser print-dialog blur; native Ctrl+P remains fail-closed.
      window.print();
      window.setTimeout(() => {
        if (printGrantUntil.current !== grant) return;
        redact();
        if (document.visibilityState === "visible") void revalidate(true);
      }, REQUEST_TIMEOUT_MS);
    } catch {
      if (sequence !== epoch.current) return;
      redact();
      setMessage(accessDenied);
    } finally {
      window.clearTimeout(deadline);
      if (pending.current === controller) pending.current = null;
      if (sequence === epoch.current) setWorking(false);
    }
  }

  return (
    <section className="school-card" aria-labelledby="my-lessons">
      <h2 id="my-lessons">Released class lessons</h2>
      <p>
        Only lessons approved and explicitly released for your currently
        verified class and academic term appear here.
      </p>
      <div ref={privatePanel} hidden={!authorized}>
        <ul>
          {lessons.map((item) => (
            <li key={item.id}>
              {item.kind === "SCHEME_OF_WORK" ? "Scheme of work" : "Lesson note"}{" "}
              · {item.subjectName}: {item.topic} — {item.className},{" "}
              {item.termName}
              {item.weekStart ? ` · Weeks ${item.weekStart}–${item.weekEnd}` : ""}
              <button
                type="button"
                disabled={working}
                onClick={() => void open(item.id)}
              >
                Open lesson
              </button>
            </li>
          ))}
        </ul>
        {active && (
          <article>
            <h3>{active.topic}</h3>
            <h4>Learning objectives</h4>
            <p style={{ whiteSpace: "pre-wrap" }}>{active.objectives}</p>
            <h4>Lesson content</h4>
            <p style={{ whiteSpace: "pre-wrap" }}>{active.content}</p>
            <button
              type="button"
              disabled={working}
              onClick={() => void printLesson()}
            >
              Print this lesson
            </button>
          </article>
        )}
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
