"use client";

import { useEffect, useState } from "react";

type GradeRow = {
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  rawPercentBps: number;
  displayPercent: string;
  gradeCode: string;
  remark: string;
  categoryPercentBps: {
    QUIZ: number | null;
    TEST: number | null;
    EXAM: number | null;
  };
};
type Preview = {
  compositionId: string;
  evidenceRevision: number;
  aggregationRuleVersion: number;
  gradeScaleVersion: number;
  studentCount: number;
  status: "PRIVATE_GRADE_PREVIEW_NOT_RELEASED";
  students: GradeRow[];
};
function percent(value: number | null) {
  return value === null ? "Not assessed" : `${(value / 100).toFixed(2)}%`;
}

/** Rendered only on deliberate owner click; not a published report card. */
export function PrivateGradePreview({
  schoolId,
  compositionId,
  onClose,
}: {
  schoolId: string;
  compositionId: string;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/schools/${encodeURIComponent(schoolId)}/private-official-report-compositions/${encodeURIComponent(compositionId)}/preview`,
      {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Preview access denied");
        return response.json() as Promise<{ preview: Preview }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          if (body.preview.status !== "PRIVATE_GRADE_PREVIEW_NOT_RELEASED")
            throw new Error("Unrecognized private preview");
          setPreview(body.preview);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Grade preview unavailable. Your school access or historical evidence may have changed.",
          );
      });
    return () => controller.abort();
  }, [schoolId, compositionId]);
  return (
    <section aria-labelledby="grade-preview-heading">
      <h3 id="grade-preview-heading">Private grade preview — not published</h3>
      <p>
        Confidential school-owner inspection of one frozen historical
        composition. These marks are not released to students or guardians. This
        screen is not a report card, publication decision, download or export.
      </p>
      <button type="button" onClick={onClose}>
        Hide confidential preview
      </button>
      <p role="status" aria-live="polite">
        {error ||
          (!preview
            ? "Loading confidential preview…"
            : `Evidence revision ${preview.evidenceRevision}. ${preview.studentCount} pupils. Aggregation policy v${preview.aggregationRuleVersion}; grading scale v${preview.gradeScaleVersion}.`)}
      </p>
      {preview && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>
              School-owner-only unreleased subject grade evidence
            </caption>
            <thead>
              <tr>
                <th scope="col">Admission no.</th>
                <th scope="col">Pupil</th>
                <th scope="col">Quiz</th>
                <th scope="col">Test</th>
                <th scope="col">Exam</th>
                <th scope="col">Raw score</th>
                <th scope="col">Displayed score</th>
                <th scope="col">Grade</th>
                <th scope="col">Remark</th>
              </tr>
            </thead>
            <tbody>
              {preview.students.map((row) => (
                <tr key={row.studentId}>
                  <th scope="row">{row.admissionNumber}</th>
                  <td>
                    {row.givenName} {row.familyName}
                  </td>
                  <td>{percent(row.categoryPercentBps.QUIZ)}</td>
                  <td>{percent(row.categoryPercentBps.TEST)}</td>
                  <td>{percent(row.categoryPercentBps.EXAM)}</td>
                  <td>{percent(row.rawPercentBps)}</td>
                  <td>{row.displayPercent}%</td>
                  <td>{row.gradeCode}</td>
                  <td>{row.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
