"use client";
import { useEffect, useState } from "react";

type Subject = {
  studentId: string; recipientRole: "PARENT" | "STUDENT";
  admissionNumber: string; givenName: string;
  familyName: string; schoolName: string; sessionName: string; termName: string;
  className: string; subjectName: string;
  sessionId: string; termId: string; classId: string;
  releaseId: string; policyMode: string; guardianHasAcknowledged: boolean;
  releaseOrdinal: number; displayPercent: string;
  gradeCode: string; remark: string; releasedAt: string;
};
export function PublishedReportWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}/published-reports`;
  const [rows, setRows] = useState<Subject[]>([]);
  const [status, setStatus] = useState("Verifying recipient access…");
  const [busyId, setBusyId] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    fetch(root, { cache: "no-store", credentials: "same-origin",
      signal: abort.signal }).then(async r => {
      if (!r.ok) throw Error("Access denied");
      return r.json();
    }).then(data => {
      if (!active) return;
      setRows(data.reports);
      setStatus(data.reports.length ?
        "Only your independently published and currently authorized grades are shown." :
        "No released grades are visible to this account under the current school policy.");
    }).catch(() => {
      if (!active) return;
      setRows([]);
      setStatus("Published report access is unavailable, disabled or not authorized.");
    });
    return () => { active = false; abort.abort(); };
  }, [root, refresh]);
  const groups = new Map<string, Subject[]>();
  for (const row of rows) {
    const key = [row.studentId,row.sessionId,row.termId,row.classId].join("/");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  async function acknowledge(row: Subject) {
    if (busyId) return;
    setBusyId(row.releaseId); setStatus("");
    try {
      const target = `${root}/acknowledgments/${encodeURIComponent(row.releaseId)}/${encodeURIComponent(row.studentId)}`;
      const response = await fetch(target, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledge: true }),
      });
      if (!response.ok) throw Error("Receipt denied");
      setStatus("This exact released subject was acknowledged. Student access remains subject to independent current checks.");
      setRefresh(v => v + 1);
    } catch {
      setStatus("Acknowledgment denied or already recorded. Check guardian link, release and school policy.");
    } finally { setBusyId(""); }
  }
  return <section className="school-card">
    <p>Only released individual-subject grades appear here. This is not a
      class ranking or a claim that all subjects have been published.
      Historical grade corrections require new release versions.</p>
    <div className="print-hide">
      <button type="button" disabled={!rows.length} onClick={() => window.print()}>
        Print authorized subject report / Save as PDF
      </button>
    </div>
    {Array.from(groups.entries()).map(([key, subjects]) => {
      const first = subjects[0];
      return <article key={key} className="school-card">
        <h2>{first.schoolName} — {first.sessionName} / {first.termName}</h2>
        <h3>{first.className} — {first.givenName} {first.familyName}</h3>
        <p>Admission number: {first.admissionNumber}</p>
        <p>Officially released subjects only ({subjects.length} shown)</p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>Individually authorized subject grades</caption>
            <thead><tr><th scope="col">Subject</th><th scope="col">Score</th>
              <th scope="col">Grade</th><th scope="col">School remark</th>
              <th scope="col">Published version</th><th scope="col" className="print-hide">Acknowledgment</th>
            </tr></thead>
            <tbody>{subjects.map(row => <tr key={row.releaseId}>
              <th scope="row">{row.subjectName}</th>
              <td>{row.displayPercent}%</td><td>{row.gradeCode}</td>
              <td>{row.remark}</td><td>{row.releaseOrdinal}</td>
              <td className="print-hide">
                {row.policyMode === "GUARDIAN_FIRST_ACK" &&
                  row.recipientRole === "PARENT" && !row.guardianHasAcknowledged ?
                  <button type="button" disabled={!!busyId}
                    onClick={() => acknowledge(row)}>
                    Acknowledge this published subject
                  </button> : row.policyMode === "GUARDIAN_FIRST_ACK" &&
                  row.recipientRole === "PARENT" ?
                  "Acknowledged" : "Not required"}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
        <p>Generated only from current authorization checks.
          Printing or saving a copy places responsibility for that copy
          with the signed-in recipient.</p>
      </article>;
    })}
    <p role="status" aria-live="polite">{status}</p>
    <style jsx global>{`@media print {
      .print-hide, .topbar { display: none !important; }
      .workspace, .workspace-content, .school-card {
        display: block !important; max-width: none !important; margin: 0 !important;
        padding: 0.35rem !important; box-shadow: none !important;
        color: black !important; background: white !important;
      }
      table { width: 100%; border-collapse: collapse; }
      td,th { border: 1px solid black; padding: 0.35rem; }
      article { break-after: page; }
    }`}</style>
  </section>;
}
