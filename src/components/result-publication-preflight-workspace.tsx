"use client";

import { useEffect, useState } from "react";

type Candidate = {
  evidenceId: string;
  revision: number;
  className: string;
  subjectName: string;
  termId: string;
  studentCount: number;
  reviewedAt: string;
};

export function ResultPublicationPreflightWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const [items, setItems] = useState<Candidate[]>([]);
  const [message, setMessage] = useState(
    "Checking current independently reviewed sources…",
  );
  useEffect(() => {
    let live = true;
    fetch(
      `/api/schools/${encodeURIComponent(schoolId)}/result-publication-candidates`,
      {
        cache: "no-store",
        credentials: "same-origin",
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Candidate list unavailable");
        return response.json();
      })
      .then((body: { candidates: Candidate[] }) => {
        if (!live) return;
        setItems(body.candidates);
        setMessage(
          body.candidates.length
            ? "Current academic approvals found. Publication remains disabled."
            : "No currently eligible reviewed snapshots. Publication remains disabled.",
        );
      })
      .catch(() => {
        if (live) {
          setItems([]);
          setMessage(
            "Unable to check the current approved snapshots. Nothing is published.",
          );
        }
      });
    return () => {
      live = false;
    };
  }, [schoolId]);
  return (
    <section className="school-card" aria-labelledby="result-preflight-title">
      <h2 id="result-preflight-title">
        Independently reviewed result evidence
      </h2>
      <p>
        School Super Admin only. This screen displays limited class and subject
        metadata for approved evidence that still matches the school’s current
        policy and source records. It is not an official result, report card, a
        student-level grade, or permission to publish.
      </p>
      <p>
        No publishing, grading, export, or student/guardian access actions are
        available.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.evidenceId}>
              {item.className} / {item.subjectName} / term {item.termId}:{" "}
              revision {item.revision}, {item.studentCount} enrolled pupils;{" "}
              academic review recorded{" "}
              {new Date(item.reviewedAt).toLocaleDateString()}.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
