"use client";
import { useState } from "react";
import { NoticeActionForm } from "./notice-action-form";
import { usePrivateCommunication } from "./use-private-communication";
interface Work {
  id: string;
  revision: number;
  text: string;
  assetReleaseIds: string[];
  createdAt: string;
  reviewAction: string | null;
  reviewReason: string | null;
  own: boolean;
  studentLabel: string;
}
export interface ReleasedLearningTask {
  id: string;
  title: string;
  body: string;
  revision: number;
  dueAt: string;
  timeZone: string;
  submissionsEnabled: boolean;
  imageReferencesEnabled: boolean;
  lateAllowed: boolean;
  submissionWindowOpen: boolean;
  resubmissionAllowed: boolean;
  assetReleaseIds: string[];
}
export function LearningSubmissions({
  schoolId,
  task,
  role,
}: {
  schoolId: string;
  task: ReleasedLearningTask;
  role: string;
}) {
  const [cursor, setCursor] = useState<string | undefined>();
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const { view, message, panel, load } = usePrivateCommunication<{
    submissions: Work[];
    nextCursor: string | null;
  }>(
    `${root}/learning-assignment-releases/${task.id}/submissions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
  const latest = view?.submissions
    .filter((s) => s.own)
    .sort((a, b) => b.revision - a.revision)[0];
  const canSubmit =
    role === "STUDENT" &&
    task.submissionsEnabled &&
    task.submissionWindowOpen &&
    (!latest || (task.resubmissionAllowed && latest.reviewAction === "RETURN"));
  const saved = () => {
      void load();
    },
    reason = { name: "reason", label: "Feedback reason" };
  return (
    <section
      className="finance-controls"
      aria-label="Learning submissions and feedback"
    >
      <h2>Submitted work and feedback</h2>
      <p role="status">{message}</p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            {canSubmit && (
              <NoticeActionForm
                title={
                  latest ? "Resubmit learning work" : "Submit learning work"
                }
                endpoint={`${root}/learning-assignment-releases/${task.id}/submissions`}
                fields={[
                  { name: "text", label: "Your work", type: "textarea" },
                  ...(task.imageReferencesEnabled && task.assetReleaseIds.length
                    ? [
                        {
                          name: "images",
                          multiple: true,
                          label: "Approved task image reference (optional)",
                          type: "select" as const,
                          required: false,
                          options: task.assetReleaseIds.map((id, i) => ({
                            value: id,
                            label: `Approved image ${i + 1}`,
                          })),
                        },
                      ]
                    : []),
                ]}
                build={(f) => ({
                  expectedSubmissionRevision: latest?.revision ?? 0,
                  text: String(f.get("text") ?? "").trim(),
                  assetReleaseIds: f
                    .getAll("images")
                    .map(String)
                    .filter(Boolean),
                })}
                onSaved={saved}
              />
            )}
            {!canSubmit && role === "STUDENT" && (
              <p>
                Submission is closed or awaiting teacher feedback under this
                assignment’s policy.
              </p>
            )}
            <div className="finance-toolbar">
              {cursor && (
                <button onClick={() => setCursor(undefined)}>
                  Newest submitted work
                </button>
              )}
              {view.nextCursor && (
                <button onClick={() => setCursor(view.nextCursor!)}>
                  Older submitted work
                </button>
              )}
            </div>
            {!view.submissions.length && (
              <p>No currently authorized submitted work.</p>
            )}
            {view.submissions.map((s) => (
              <article
                className="report-card"
                key={s.id}
                aria-label={`Submitted work ${s.id}`}
              >
                <h3>
                  {s.own ? "Your work" : s.studentLabel} — revision {s.revision}
                </h3>
                <p className="notice-body">{s.text}</p>
                <p>
                  {s.reviewAction === "APPROVE"
                    ? "Accepted"
                    : s.reviewAction === "RETURN"
                      ? "Returned for revision"
                      : "Awaiting teacher feedback"}
                </p>
                {s.reviewReason && <p>{s.reviewReason}</p>}
                {s.assetReleaseIds.map((id, i) => (
                  <p key={id}>
                    <a href={`${root}/library/asset-releases/${id}/download`}>
                      Download approved reference {i + 1}
                    </a>
                  </p>
                ))}
                {!s.own &&
                  !s.reviewAction &&
                  ["APPROVE", "RETURN"].map((action) => (
                    <NoticeActionForm
                      key={action}
                      title={
                        action === "APPROVE"
                          ? "Accept submitted work"
                          : "Return submitted work"
                      }
                      endpoint={`${root}/learning-submissions/${s.id}/review`}
                      fields={[reason]}
                      build={(f) => ({
                        action,
                        reason: String(f.get("reason") ?? "").trim(),
                      })}
                      onSaved={saved}
                    />
                  ))}
              </article>
            ))}
          </>
        )}
      </div>
      <p>Learning feedback is recorded separately from official grades.</p>
    </section>
  );
}
