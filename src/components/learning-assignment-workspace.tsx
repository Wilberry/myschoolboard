"use client";
import Link from "next/link";
import { NotificationInbox } from "./notification-inbox";
import { NoticeActionForm, type NoticeField } from "./notice-action-form";
import { usePrivateCommunication } from "./use-private-communication";
import {
  LearningSubmissions,
  type ReleasedLearningTask,
} from "./learning-submissions";
interface Policy {
  id: string;
  version: number;
  timeZone: string;
  allowFormTasks: boolean;
  allowTextSubmissions: boolean;
  allowImageReferences: boolean;
  allowLateSubmissions: boolean;
  allowResubmission: boolean;
}
interface Managed {
  id: string;
  title: string;
  body: string;
  revision: number;
  dueAt: string;
  submissionsEnabled: boolean;
  imageReferencesEnabled: boolean;
  timeZone: string;
  policyCurrent: boolean;
  canRelease: boolean;
  assetReleaseIds: string[];
  state: string;
  own: boolean;
  releaseId: string | null;
  releaseRevision: number | null;
}
interface View {
  role: string;
  policy: Policy | null;
  tasks: Managed[];
  authorities: Array<{
    id: string;
    kind: string;
    label: string;
    termId: string;
  }>;
  feed: ReleasedLearningTask[];
  moderation: Array<{ id: string; taskId: string; revision: number }>;
  resources: Array<{ id: string; label: string }>;
}
export function LearningAssignmentWorkspace({
  schoolId,
  releaseId,
}: {
  schoolId: string;
  releaseId?: string;
}) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const { view, message, panel, load, print } = usePrivateCommunication<View>(
    `${root}/learning-assignment-workspace${releaseId ? "?releaseId=" + encodeURIComponent(releaseId) : ""}`,
  );
  const saved = () => {
      void load();
    },
    text = (f: FormData, n: string) => String(f.get(n) ?? "").trim(),
    reason: NoticeField = { name: "reason", label: "Decision reason" };
  const yesNo = [
    { value: "false", label: "Disabled" },
    { value: "true", label: "Enabled" },
  ];
  const fields = (task?: Managed): NoticeField[] => [
    { name: "title", label: "Assignment title", value: task?.title },
    {
      name: "body",
      label: "Learning instructions",
      type: "textarea",
      value: task?.body,
    },
    {
      name: "dueAt",
      label: "Due time (UTC)",
      type: "datetime-local",
      value: task ? new Date(task.dueAt).toISOString().slice(0, -1) : undefined,
    },
    ...(view?.policy?.allowTextSubmissions
      ? [
          {
            name: "submissionsEnabled",
            label: "Allow text submissions",
            type: "select" as const,
            options: yesNo,
          },
        ]
      : []),
    ...(view?.policy?.allowImageReferences
      ? [
          {
            name: "imageReferencesEnabled",
            label: "Allow approved image references in submitted work",
            type: "select" as const,
            options: yesNo,
          },
        ]
      : []),
    ...((view?.resources.length ?? 0) > 0
      ? [
          {
            name: "resources",
            label: "Approved learning images (up to three, optional)",
            multiple: true,
            values: task?.assetReleaseIds ?? [],
            type: "select" as const,
            required: false,
            options: view!.resources.map((r) => ({
              value: r.id,
              label: r.label,
            })),
          },
        ]
      : []),
    reason,
  ];
  const content = (f: FormData) => ({
    title: text(f, "title"),
    body: text(f, "body"),
    dueAt: new Date(text(f, "dueAt") + "Z").toISOString(),
    submissionsEnabled: text(f, "submissionsEnabled") === "true",
    imageReferencesEnabled: text(f, "imageReferencesEnabled") === "true",
    assetReleaseIds: f.getAll("resources").map(String).filter(Boolean),
    reason: text(f, "reason"),
  });
  return (
    <section
      className="financial-workspace communication-workspace"
      aria-label="Learning assignments"
    >
      <div className="finance-toolbar finance-controls">
        <button onClick={() => void load()}>Recheck access</button>
        <button onClick={() => void print()}>
          Print released learning instructions
        </button>
      </div>
      <p role="status">{message}</p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            <h2>Learning assignments</h2>
            <NotificationInbox schoolId={schoolId} channel="module" />
            {!view.feed.length && !view.tasks.length && (
              <p>No current assignments in your authorized scope.</p>
            )}
            {view.feed.map((task) => (
              <article key={task.id} className="report-card notice-release">
                <h3>{task.title}</h3>
                <p className="notice-body">{task.body}</p>
                <p>
                  Due:{" "}
                  {new Intl.DateTimeFormat("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: task.timeZone,
                  }).format(new Date(task.dueAt))}{" "}
                  ({task.timeZone})
                </p>
                {task.assetReleaseIds.map((id, i) => (
                  <p key={id}>
                    <a href={`${root}/library/asset-releases/${id}/download`}>
                      Download approved learning image {i + 1}
                    </a>
                  </p>
                ))}
                {releaseId ? (
                  <LearningSubmissions
                    schoolId={schoolId}
                    task={task}
                    role={view.role}
                  />
                ) : (
                  <p className="finance-controls">
                    <Link
                      prefetch={false}
                      href={`/schools/${schoolId}/learning-assignments?releaseId=${task.id}`}
                    >
                      Open assignment and feedback
                    </Link>
                  </p>
                )}
              </article>
            ))}
            <div className="finance-controls">
              {view.policy && (
                <p>
                  Policy version {view.policy.version}; school timezone{" "}
                  {view.policy.timeZone}. Enter deadlines in UTC; released
                  instructions display the school timezone.
                </p>
              )}
              {view.role === "SCHOOL_SUPER_ADMIN" && !releaseId && (
                <>
                  <h2>Learning assignment policy and moderation</h2>
                  <NoticeActionForm
                    title="Adopt learning assignment policy"
                    endpoint={root + "/learning-assignment-policies"}
                    fields={[
                      {
                        name: "timeZone",
                        label: "School timezone",
                        value: view.policy?.timeZone ?? "UTC",
                      },
                      ...(
                        [
                          "allowFormTasks",
                          "allowTextSubmissions",
                          "allowImageReferences",
                          "allowLateSubmissions",
                          "allowResubmission",
                        ] as const
                      ).map((name) => ({
                        name,
                        label: {
                          allowFormTasks: "Allow Form Teacher class tasks",
                          allowTextSubmissions: "Allow text submissions",
                          allowImageReferences:
                            "Allow approved image references",
                          allowLateSubmissions: "Allow late submissions",
                          allowResubmission: "Allow resubmission after return",
                        }[name],
                        type: "select" as const,
                        options: yesNo,
                      })),
                      reason,
                    ]}
                    build={(f) => ({
                      timeZone: text(f, "timeZone"),
                      allowFormTasks: text(f, "allowFormTasks") === "true",
                      allowTextSubmissions:
                        text(f, "allowTextSubmissions") === "true",
                      allowImageReferences:
                        text(f, "allowImageReferences") === "true",
                      allowLateSubmissions:
                        text(f, "allowLateSubmissions") === "true",
                      allowResubmission:
                        text(f, "allowResubmission") === "true",
                      reason: text(f, "reason"),
                    })}
                    onSaved={saved}
                  />
                  {view.moderation.map((m) => (
                    <NoticeActionForm
                      key={m.id}
                      title={`Withdraw learning release ${m.id}`}
                      endpoint={`${root}/learning-assignments/${m.taskId}/decision`}
                      fields={[reason]}
                      build={(f) => ({
                        action: "WITHDRAW",
                        targetReleaseId: m.id,
                        expectedRevision: m.revision,
                        reason: text(f, "reason"),
                      })}
                      onSaved={saved}
                    />
                  ))}
                </>
              )}
              {!view.policy &&
                ["TEACHER", "FORM_TEACHER"].includes(view.role) && (
                  <p>
                    The school owner must adopt a learning assignment policy
                    before tasks can be created.
                  </p>
                )}
              {view.policy &&
                view.authorities.map((c) => (
                  <NoticeActionForm
                    key={c.id + "-" + c.termId}
                    title={`Create learning assignment: ${c.label}`}
                    endpoint={root + "/learning-assignments"}
                    fields={fields()}
                    build={(f) => ({
                      ...content(f),
                      termId: c.termId,
                      policyId: view.policy!.id,
                      ...(c.kind === "SUBJECT"
                        ? { assignmentId: c.id }
                        : { formResponsibilityId: c.id }),
                    })}
                    onSaved={saved}
                  />
                ))}
              {view.tasks.map((task) => (
                <article
                  className="report-card"
                  key={task.id}
                  aria-label={`Managed learning assignment ${task.id}`}
                >
                  <h3>{task.title}</h3>
                  <p>
                    Revision {task.revision}: {task.state}
                  </p>
                  <p className="notice-body">{task.body}</p>
                  {!task.policyCurrent && (
                    <p>
                      The school policy has changed. A new task must use the
                      current policy before publication.
                    </p>
                  )}
                  {task.own &&
                    task.policyCurrent &&
                    task.state !== "SUBMIT" && (
                      <NoticeActionForm
                        title="Revise learning assignment"
                        endpoint={`${root}/learning-assignments/${task.id}/revisions`}
                        fields={fields(task)}
                        build={(f) => ({
                          ...content(f),
                          expectedRevision: task.revision,
                        })}
                        onSaved={saved}
                      />
                    )}
                  {(task.own && task.state === "DRAFT"
                    ? ["SUBMIT"]
                    : !task.own && task.state === "SUBMIT"
                      ? task.policyCurrent
                        ? ["APPROVE", "RETURN"]
                        : ["RETURN"]
                      : task.own && task.state === "APPROVE" && task.canRelease
                        ? ["RELEASE"]
                        : []
                  ).map((action) => (
                    <NoticeActionForm
                      key={action}
                      title={
                        action === "SUBMIT"
                          ? "Submit learning assignment for review"
                          : action === "APPROVE"
                            ? "Approve learning assignment revision"
                            : action === "RETURN"
                              ? "Return learning assignment revision"
                              : "Release reviewed learning assignment"
                      }
                      endpoint={`${root}/learning-assignments/${task.id}/decision`}
                      fields={[reason]}
                      build={(f) => ({
                        action,
                        expectedRevision: task.revision,
                        reason: text(f, "reason"),
                      })}
                      onSaved={saved}
                    />
                  ))}
                  {task.own && task.releaseId && (
                    <>
                      <p>
                        <Link
                          prefetch={false}
                          href={`/schools/${schoolId}/learning-assignments?releaseId=${task.releaseId}`}
                        >
                          Open released task and submitted work
                        </Link>
                      </p>
                      <NoticeActionForm
                        title="Withdraw learning assignment"
                        endpoint={`${root}/learning-assignments/${task.id}/decision`}
                        fields={[reason]}
                        build={(f) => ({
                          action: "WITHDRAW",
                          targetReleaseId: task.releaseId,
                          expectedRevision: task.releaseRevision,
                          reason: text(f, "reason"),
                        })}
                        onSaved={saved}
                      />
                    </>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
