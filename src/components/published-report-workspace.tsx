"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { fetchCurrentRecipientRows } from "@/src/modules/results/recipient-browser-delivery";

type Subject = {
  studentId: string;
  recipientRole: "PARENT" | "STUDENT";
  admissionNumber: string;
  givenName: string;
  familyName: string;
  schoolName: string;
  sessionName: string;
  termName: string;
  className: string;
  subjectName: string;
  sessionId: string;
  termId: string;
  classId: string;
  releaseId: string;
  policyMode: string;
  guardianHasAcknowledged: boolean;
  releaseOrdinal: number;
  displayPercent: string;
  gradeCode: string;
  remark: string;
  releasedAt: string;
};
export function PublishedReportWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}/published-reports`;
  const [rows, setRows] = useState<Subject[]>([]);
  const [status, setStatus] = useState("Verifying recipient access…");
  const [busyId, setBusyId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [printAllowed, setPrintAllowed] = useState(false);
  const fetchRef = useRef<AbortController | null>(null);
  const printFetchRef = useRef<AbortController | null>(null);
  const printingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    fetchRef.current = abort;
    fetchCurrentRecipientRows<Subject>(root, abort.signal)
      .then((latest) => {
        if (!active || abort.signal.aborted) return;
        setRows(latest);
        setStatus(
          latest.length
            ? "Only your independently published and currently authorized grades are shown."
            : "No released grades are visible to this account under the current school policy.",
        );
      })
      .catch(() => {
        if (!active || abort.signal.aborted) return;
        setRows([]);
        setStatus(
          "Published report access is unavailable, disabled or not authorized.",
        );
      });
    return () => {
      active = false;
      abort.abort();
      if (fetchRef.current === abort) fetchRef.current = null;
    };
  }, [root, refresh]);

  useEffect(() => {
    // A browser back-forward cache entry or tab hidden during account
    // revocation must never display the former user's result from React state.
    const discard = () => {
      fetchRef.current?.abort();
      printFetchRef.current?.abort();
      flushSync(() => {
        setRows([]);
        setPrintAllowed(false);
        setStatus("Recipient access must be rechecked.");
      });
    };
    const onVisibility = () => {
      if (printingRef.current) return;
      discard();
      if (!document.hidden) setRefresh((value) => value + 1);
    };
    const onPageHide = () => discard();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        discard();
        setRefresh((value) => value + 1);
      }
    };
    const onAfterPrint = () => {
      printingRef.current = false;
      discard();
      if (!document.hidden) setRefresh((value) => value + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  async function printAuthorizedReport() {
    if (busyId || !rows.length || document.hidden) return;
    const abort = new AbortController();
    printFetchRef.current = abort;
    setBusyId("print");
    setRows([]);
    setPrintAllowed(false);
    setStatus("Rechecking current school permission before printing…");
    try {
      // Never print React state retained from an earlier access decision.
      const latest = await fetchCurrentRecipientRows<Subject>(
        root,
        abort.signal,
      );
      if (abort.signal.aborted || document.hidden || latest.length === 0)
        throw new Error("Printing not authorized");
      printingRef.current = true;
      flushSync(() => {
        setRows(latest);
        setPrintAllowed(true);
      });
      window.print();
      // Some print dialogs do not dispatch afterprint. Restrict the permit
      // even then; a subsequent print requires a new authenticated GET.
      window.setTimeout(() => {
        if (printingRef.current) {
          printingRef.current = false;
          setPrintAllowed(false);
          setRows([]);
          setRefresh((value) => value + 1);
        }
      }, 30_000);
    } catch {
      printingRef.current = false;
      setRows([]);
      setPrintAllowed(false);
      setStatus(
        "Printing denied: current recipient permission could not be confirmed.",
      );
    } finally {
      if (printFetchRef.current === abort) printFetchRef.current = null;
      setBusyId("");
    }
  }
  const groups = new Map<string, Subject[]>();
  for (const row of rows) {
    const key = [row.studentId, row.sessionId, row.termId, row.classId].join(
      "/",
    );
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  async function acknowledge(row: Subject) {
    if (busyId) return;
    setBusyId(row.releaseId);
    setStatus("");
    try {
      const target = `${root}/acknowledgments/${encodeURIComponent(row.releaseId)}/${encodeURIComponent(row.studentId)}`;
      const response = await fetch(target, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledge: true }),
      });
      if (!response.ok) throw Error("Receipt denied");
      setStatus(
        "This exact released subject was acknowledged. Student access remains subject to independent current checks.",
      );
      setRefresh((v) => v + 1);
    } catch {
      setStatus(
        "Acknowledgment denied or already recorded. Check guardian link, release and school policy.",
      );
    } finally {
      setBusyId("");
    }
  }
  return (
    <section
      className="school-card published-report-workspace"
      data-print-authorized={printAllowed ? "true" : "false"}
    >
      <p>
        Only released individual-subject grades appear here. This is not a class
        ranking or a claim that all subjects have been published. Historical
        grade corrections require new release versions.
      </p>
      <p className="print-hide">
        Use the button below to recheck school permission before printing.
        Browser printing shortcuts do not authorize confidential grades.
      </p>
      <div className="print-hide">
        <button
          type="button"
          disabled={!rows.length || !!busyId}
          onClick={() => void printAuthorizedReport()}
        >
          Print authorized subject report / Save as PDF
        </button>
      </div>
      {Array.from(groups.entries()).map(([key, subjects]) => {
        const first = subjects[0];
        return (
          <article key={key} className="school-card">
            <h2>
              {first.schoolName} — {first.sessionName} / {first.termName}
            </h2>
            <h3>
              {first.className} — {first.givenName} {first.familyName}
            </h3>
            <p>Admission number: {first.admissionNumber}</p>
            <p>Officially released subjects only ({subjects.length} shown)</p>
            <div style={{ overflowX: "auto" }}>
              <table>
                <caption>Individually authorized subject grades</caption>
                <thead>
                  <tr>
                    <th scope="col">Subject</th>
                    <th scope="col">Score</th>
                    <th scope="col">Grade</th>
                    <th scope="col">School remark</th>
                    <th scope="col">Published version</th>
                    <th scope="col" className="print-hide">
                      Acknowledgment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((row) => (
                    <tr key={row.releaseId}>
                      <th scope="row">{row.subjectName}</th>
                      <td>{row.displayPercent}%</td>
                      <td>{row.gradeCode}</td>
                      <td>{row.remark}</td>
                      <td>{row.releaseOrdinal}</td>
                      <td className="print-hide">
                        {row.policyMode === "GUARDIAN_FIRST_ACK" &&
                        row.recipientRole === "PARENT" &&
                        !row.guardianHasAcknowledged ? (
                          <button
                            type="button"
                            disabled={!!busyId}
                            onClick={() => acknowledge(row)}
                          >
                            Acknowledge this published subject
                          </button>
                        ) : row.policyMode === "GUARDIAN_FIRST_ACK" &&
                          row.recipientRole === "PARENT" ? (
                          "Acknowledged"
                        ) : (
                          "Not required"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Generated only from current authorization checks. Printing or
              saving a copy places responsibility for that copy with the
              signed-in recipient.
            </p>
          </article>
        );
      })}
      <p role="status" aria-live="polite">
        {status}
      </p>
      <style jsx global>{`
        @media print {
          .published-report-workspace[data-print-authorized="false"] article {
            display: none !important;
          }
          .print-hide,
          .topbar {
            display: none !important;
          }
          .workspace,
          .workspace-content,
          .school-card {
            display: block !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0.35rem !important;
            box-shadow: none !important;
            color: black !important;
            background: white !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          td,
          th {
            border: 1px solid black;
            padding: 0.35rem;
          }
          article {
            break-after: page;
          }
        }
      `}</style>
    </section>
  );
}
