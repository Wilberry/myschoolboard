"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listenForSessionSignOut } from "@/src/lib/auth-session-events";
import type { RecipientReport } from "@/src/modules/results/publication-service";

export function PublishedReportsWorkspace({
  schoolId,
  guardian,
}: {
  schoolId: string;
  guardian: boolean;
}) {
  const [reports, setReports] = useState<RecipientReport[]>([]);
  const [message, setMessage] = useState("Checking report access…");
  const panel = useRef<HTMLDivElement>(null);
  const epoch = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const printPermit = useRef(false);
  const conceal = useCallback(
    (text = "Reports concealed. Recheck access to continue.") => {
      ++epoch.current;
      pending.current?.abort();
      printPermit.current = false;
      if (panel.current) panel.current.hidden = true;
      setReports([]);
      setMessage(text);
    },
    [],
  );
  const load = useCallback(async () => {
    if (document.visibilityState !== "visible") return false;
    const version = ++epoch.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    if (panel.current) panel.current.hidden = true;
    setReports([]);
    setMessage("Checking current report access…");
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/published-reports`,
        {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        },
      );
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!Array.isArray(data.reports)) throw Error();
      if (
        version !== epoch.current ||
        controller.signal.aborted ||
        document.visibilityState !== "visible"
      )
        return false;
      setReports(data.reports);
      if (panel.current) panel.current.hidden = false;
      setMessage(
        data.reports.length
          ? "Published reports loaded."
          : "No reports are currently available under your school’s visibility policy.",
      );
      return data.reports.length > 0;
    } catch {
      if (version === epoch.current)
        conceal("Reports unavailable. Your access may have changed.");
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }, [schoolId, conceal]);
  useEffect(() => {
    const hide = () => conceal();
    const refresh = () => {
      void load();
    };
    const visibility = () =>
      document.visibilityState === "visible" ? refresh() : hide();
    const beforeprint = () => {
      if (!printPermit.current)
        conceal("Use Print reports to check access before printing.");
    };
    const afterprint = () => {
      printPermit.current = false;
      hide();
    };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", refresh);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("beforeprint", beforeprint);
    window.addEventListener("afterprint", afterprint);
    document.addEventListener("visibilitychange", visibility);
    const unsubscribe = listenForSessionSignOut(hide);
    const initial = window.setTimeout(refresh, 0);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      conceal();
      unsubscribe();
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("beforeprint", beforeprint);
      window.removeEventListener("afterprint", afterprint);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [load, conceal]);
  async function acknowledge(report: RecipientReport) {
    conceal("Recording acknowledgment…");
    const response = await fetch(
      `/api/schools/${encodeURIComponent(schoolId)}/report-acknowledgments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicationId: report.publicationId,
          studentId: report.studentId,
        }),
      },
    );
    if (!response.ok) {
      conceal("Acknowledgment unavailable. Recheck your access.");
      return;
    }
    await load();
  }
  async function print() {
    if (await load()) {
      const version = epoch.current;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (
            version === epoch.current &&
            document.visibilityState === "visible"
          ) {
            printPermit.current = true;
            window.print();
          }
        }),
      );
    }
  }
  return (
    <section aria-label="Published report cards">
      <div className="report-actions">
        <button onClick={() => void load()}>Recheck access</button>
        <button onClick={() => void print()}>Print reports</button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div
        ref={panel}
        className="recipient-report-cards"
        hidden={reports.length === 0}
      >
        {reports.map((report) => (
          <article
            className="report-card"
            key={`${report.publicationId}:${report.studentId}`}
          >
            <h2>
              {report.givenName} {report.familyName}
            </h2>
            <p>
              {report.className} · {report.sessionName} · {report.termName}
            </p>
            <dl>
              <dt>Subject</dt>
              <dd>{report.subjectName}</dd>
              <dt>Score</dt>
              <dd>{report.displayPercent}%</dd>
              <dt>Grade</dt>
              <dd>{report.gradeCode}</dd>
              <dt>Remark</dt>
              <dd>{report.remark}</dd>
            </dl>
            <p>Official report · Publication {report.publicationId}</p>
            {guardian && (
              <button
                className="report-actions"
                onClick={() => void acknowledge(report)}
              >
                Acknowledge this report
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
