"use client";
import { NotificationInbox } from "./notification-inbox";
import { useState } from "react";
import { NoticeActionForm } from "./notice-action-form";
import { usePrivateCommunication } from "./use-private-communication";
import type {
  ManagedNotice,
  ReleasedNotice,
} from "@/src/modules/communications/service";
interface WorkspaceView {
  role: string;
  notices: ManagedNotice[];
  policies: Array<{ id: string; version: number; audience: string }>;
  feed: ReleasedNotice[];
  deliveryIssues: Array<{
    eventId: string;
    state: string;
    failures: number;
    nextAttemptAt: string;
  }>;
}
export function NoticeWorkspace({
  schoolId,
  releaseId,
}: {
  schoolId: string;
  releaseId?: string;
}) {
  const [deliveryBusy, setDeliveryBusy] = useState(false),
    [deliveryMessage, setDeliveryMessage] = useState("");
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const url = releaseId
    ? `${root}/my-notices?releaseId=${encodeURIComponent(releaseId)}`
    : `${root}/notice-workspace`;
  const { view, message, panel, load, print } = usePrivateCommunication<
    WorkspaceView | { notices: ReleasedNotice[] }
  >(url);
  const data = view && !releaseId ? (view as WorkspaceView) : null;
  const released = view
    ? releaseId
      ? (view as { notices: ReleasedNotice[] }).notices
      : (view as WorkspaceView).feed
    : [];
  const owner = data?.role === "SCHOOL_SUPER_ADMIN";
  const author = owner || data?.role === "SCHOOL_ADMIN";
  const saved = () => {
    void load();
  };
  const reason = { name: "reason", label: "Decision reason" };
  const text = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
  async function deliver() {
    if (deliveryBusy) return;
    setDeliveryBusy(true);
    setDeliveryMessage("Delivering pending in-app alerts…");
    try {
      const r = await fetch(`${root}/notice-delivery`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error();
      setDeliveryMessage("In-app delivery request processed.");
      saved();
    } catch {
      setDeliveryMessage(
        "Unable to process in-app delivery. Recheck access and retry.",
      );
    } finally {
      setDeliveryBusy(false);
    }
  }
  return (
    <section
      className="financial-workspace communication-workspace"
      aria-label="School notices and in-app notifications"
    >
      <div className="finance-controls finance-toolbar">
        <button onClick={() => void load()}>Recheck access</button>
        <button onClick={() => void print()}>Print released notices</button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            <h2>Released school notices</h2>
            <p>
              Only explicitly published school notices permitted by your current
              school policy and identity are shown.
            </p>
            {!released.length && (
              <p>No school notices are currently available to you.</p>
            )}
            {released.map((n) => (
              <article
                key={n.id}
                aria-label={`Released notice ${n.id}`}
                className="report-card notice-release"
              >
                <h3>{n.title}</h3>
                <p className="notice-body">{n.body}</p>
                <small>Published revision {n.revision}</small>
              </article>
            ))}
            {data && (
              <>
                <NotificationInbox schoolId={schoolId} />
                {author && (
                  <div className="finance-controls">
                    <h2>School notice authoring and review</h2>
                    <p>
                      School Administrators author notices. The school owner
                      independently reviews administrator-authored notices and
                      explicitly publishes an exact reviewed revision.
                    </p>
                    <NoticeActionForm
                      title="Create school notice"
                      endpoint={`${root}/notices`}
                      fields={[
                        { name: "title", label: "Notice title" },
                        {
                          name: "body",
                          label: "Notice text",
                          type: "textarea",
                        },
                        reason,
                      ]}
                      build={(f) => ({
                        title: text(f, "title"),
                        body: text(f, "body"),
                        reason: text(f, "reason"),
                      })}
                      onSaved={saved}
                    />
                    {owner && (
                      <>
                        <p>
                          A visibility policy applies when you publish a notice.
                          Withdraw an existing release to end access to that
                          notice.
                        </p>
                        <NoticeActionForm
                          title="Create notice visibility policy"
                          endpoint={`${root}/notice-policies`}
                          fields={[
                            {
                              name: "audience",
                              label: "Permitted recipients",
                              type: "select",
                              options: [
                                {
                                  value: "STAFF_ONLY",
                                  label: "Verified school staff only",
                                },
                                {
                                  value: "STUDENTS_ONLY",
                                  label: "Verified students only",
                                },
                                {
                                  value: "GUARDIANS_ONLY",
                                  label: "Verified guardians only",
                                },
                                {
                                  value: "STUDENTS_AND_GUARDIANS",
                                  label: "Verified students and guardians",
                                },
                              ],
                            },
                            reason,
                          ]}
                          build={(f) => ({
                            audience: text(f, "audience"),
                            reason: text(f, "reason"),
                          })}
                          onSaved={saved}
                        />
                        <div>
                          <button
                            onClick={() => void deliver()}
                            disabled={deliveryBusy}
                          >
                            Deliver pending school alerts
                          </button>
                          <p role="status" aria-live="polite">
                            {deliveryMessage}
                          </p>
                        </div>
                        {data.deliveryIssues.map((issue) => (
                          <article
                            key={issue.eventId}
                            aria-label={`Delivery issue ${issue.eventId}`}
                            className="report-card"
                          >
                            <h3>School alert delivery needs attention</h3>
                            <p>
                              Status: {issue.state}. Failed attempts:{" "}
                              {issue.failures}.
                            </p>
                            {issue.state === "DEAD_LETTER" ? (
                              <NoticeActionForm
                                title="Retry failed school alert"
                                endpoint={`${root}/notice-delivery/replay`}
                                fields={[reason]}
                                onSaved={saved}
                                build={(f) => ({
                                  eventId: issue.eventId,
                                  reason: text(f, "reason"),
                                })}
                              />
                            ) : (
                              <p>
                                A retry is scheduled after{" "}
                                {new Date(issue.nextAttemptAt).toLocaleString(
                                  "en-NG",
                                )}
                                .
                              </p>
                            )}
                          </article>
                        ))}
                      </>
                    )}
                    {!data.notices.length && (
                      <p>No notices are available in your authoring scope.</p>
                    )}
                    {data.notices.map((n) => (
                      <article
                        className="report-card"
                        key={n.id}
                        aria-label={`Managed notice ${n.id}`}
                      >
                        <h3>{n.title}</h3>
                        <p>
                          Revision {n.revision}: {n.state}.{" "}
                          {n.own
                            ? "Your notice."
                            : "Independent school review."}
                        </p>
                        <p className="notice-body">{n.body}</p>
                        {n.own && n.state !== "SUBMITTED" && (
                          <NoticeActionForm
                            title="Revise school notice"
                            endpoint={`${root}/notices/${n.id}/revisions`}
                            fields={[
                              {
                                name: "title",
                                label: "Revised notice title",
                                value: n.title,
                              },
                              {
                                name: "body",
                                label: "Revised notice text",
                                type: "textarea",
                                value: n.body,
                              },
                              reason,
                            ]}
                            build={(f) => ({
                              expectedRevision: n.revision,
                              title: text(f, "title"),
                              body: text(f, "body"),
                              reason: text(f, "reason"),
                            })}
                            onSaved={saved}
                          />
                        )}
                        {n.own && n.state === "DRAFT" && (
                          <NoticeActionForm
                            title="Submit notice for review"
                            endpoint={`${root}/notices/${n.id}/decision`}
                            fields={[reason]}
                            build={(f) => ({
                              action: "SUBMIT",
                              expectedRevision: n.revision,
                              reason: text(f, "reason"),
                            })}
                            onSaved={saved}
                          />
                        )}
                        {owner &&
                          n.state === "SUBMITTED" &&
                          ["APPROVE", "RETURN"].map((action) => (
                            <NoticeActionForm
                              key={action}
                              title={
                                action === "APPROVE"
                                  ? "Approve notice revision"
                                  : "Return notice revision"
                              }
                              endpoint={`${root}/notices/${n.id}/decision`}
                              fields={[reason]}
                              build={(f) => ({
                                action,
                                expectedRevision: n.revision,
                                reason: text(f, "reason"),
                              })}
                              onSaved={saved}
                            />
                          ))}
                        {owner &&
                          n.state === "APPROVED" &&
                          n.publishedRevision !== n.revision && (
                            <NoticeActionForm
                              title="Publish reviewed notice"
                              endpoint={`${root}/notices/${n.id}/publish`}
                              fields={[
                                {
                                  name: "policyId",
                                  label: "Latest explicit visibility policy",
                                  type: "select",
                                  options: data.policies
                                    .slice(0, 1)
                                    .map((p) => ({
                                      value: p.id,
                                      label: `Version ${p.version}: ${p.audience}`,
                                    })),
                                },
                                reason,
                              ]}
                              build={(f) => ({
                                expectedRevision: n.revision,
                                policyId: text(f, "policyId"),
                                reason: text(f, "reason"),
                              })}
                              onSaved={saved}
                            />
                          )}
                        {owner && n.releaseId && !n.withdrawn && (
                          <NoticeActionForm
                            title="Withdraw school notice"
                            endpoint={`${root}/notice-releases/${n.releaseId}/withdraw`}
                            fields={[reason]}
                            build={(f) => ({ reason: text(f, "reason") })}
                            onSaved={saved}
                          />
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
