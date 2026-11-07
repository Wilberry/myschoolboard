"use client";
import { NotificationInbox } from "./notification-inbox";
import { NoticeActionForm } from "./notice-action-form";
import { usePrivateCommunication } from "./use-private-communication";
interface View {
  role: string;
  moderation: Array<{ id: string; announcementId: string; revision: number }>;
  deliveryIssues: Array<{ eventId: string; state: string; failures: number }>;
  authorities: Array<{
    id: string;
    kind: string;
    label: string;
    termId: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    revision: number;
    state: string;
    own: boolean;
    releaseId: string | null;
    releaseRevision: number | null;
  }>;
  feed: Array<{ id: string; title: string; body: string; revision: number }>;
}
export function ClassAnnouncementWorkspace({
  schoolId,
  releaseId,
}: {
  schoolId: string;
  releaseId?: string;
}) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const {
    view: raw,
    message,
    panel,
    load,
    print,
  } = usePrivateCommunication<View | { announcements: View["feed"] }>(
    releaseId
      ? root +
          "/my-class-announcements?releaseId=" +
          encodeURIComponent(releaseId)
      : root + "/class-announcement-workspace",
  );
  const view = raw
    ? releaseId
      ? ({
          role: "STUDENT",
          moderation: [],
          deliveryIssues: [],
          authorities: [],
          announcements: [],
          feed: raw.announcements,
        } as View)
      : (raw as View)
    : null;
  async function deliver() {
    await fetch(root + "/class-delivery", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
    void load();
  }
  const saved = () => {
    void load();
  };
  const reason = { name: "reason", label: "Decision reason" };
  const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
  return (
    <section
      className="financial-workspace communication-workspace"
      aria-label="Class announcements"
    >
      <div className="finance-toolbar finance-controls">
        <button onClick={() => void load()}>Recheck access</button>
        <button onClick={() => void print()}>
          Print released class announcements
        </button>
      </div>
      <p role="status">{message}</p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            <h2>Class announcements</h2>
            <p>
              Class announcements are separate from official school notices.
              Guardian access is not permitted.
            </p>
            {view.feed.map((n) => (
              <article className="report-card" key={n.id}>
                <h3>{n.title}</h3>
                <p className="notice-body">{n.body}</p>
                <p>Published revision {n.revision}</p>
              </article>
            ))}
            {view.role !== "SCHOOL_SUPER_ADMIN" && (
              <NotificationInbox schoolId={schoolId} channel="class" />
            )}
            {view.role === "SCHOOL_SUPER_ADMIN" && (
              <div className="finance-controls">
                <h2>Class moderation and delivery</h2>
                <button onClick={() => void deliver()}>
                  Deliver class alerts
                </button>
                {view.moderation.map((m) => (
                  <NoticeActionForm
                    key={m.id}
                    title={`Withdraw class release ${m.id}`}
                    endpoint={`${root}/class-announcements/${m.announcementId}/decision`}
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
                {view.deliveryIssues.map((i) => (
                  <article key={i.eventId}>
                    <h3>Class alert delivery needs attention</h3>
                    <p>
                      {i.state}. Failed attempts: {i.failures}
                    </p>
                    {i.state === "DEAD_LETTER" && (
                      <NoticeActionForm
                        title={`Retry class alert ${i.eventId}`}
                        endpoint={root + "/class-delivery/replay"}
                        fields={[reason]}
                        build={(f) => ({
                          eventId: i.eventId,
                          reason: text(f, "reason"),
                        })}
                        onSaved={saved}
                      />
                    )}
                  </article>
                ))}
              </div>
            )}
            {view.authorities.map((c) => (
              <NoticeActionForm
                key={c.id + "-" + c.termId}
                title={`Create class announcement: ${c.label}`}
                endpoint={root + "/class-announcements"}
                fields={[
                  { name: "title", label: "Announcement title" },
                  {
                    name: "body",
                    label: "Announcement text",
                    type: "textarea",
                  },
                  reason,
                ]}
                build={(f) => ({
                  title: text(f, "title"),
                  body: text(f, "body"),
                  termId: c.termId,
                  ...(c.kind === "SUBJECT"
                    ? { assignmentId: c.id }
                    : { formResponsibilityId: c.id }),
                  reason: text(f, "reason"),
                })}
                onSaved={saved}
              />
            ))}
            {view.announcements.map((n) => (
              <article
                className="report-card finance-controls"
                aria-label={`Managed class announcement ${n.id}`}
                key={n.id}
              >
                <h3>{n.title}</h3>
                <p>
                  Revision {n.revision}: {n.state}
                </p>
                <p className="notice-body">{n.body}</p>
                {n.own && n.releaseId && (
                  <NoticeActionForm
                    title="Withdraw class announcement"
                    endpoint={`${root}/class-announcements/${n.id}/decision`}
                    fields={[reason]}
                    build={(f) => ({
                      action: "WITHDRAW",
                      expectedRevision: n.releaseRevision,
                      targetReleaseId: n.releaseId,
                      reason: text(f, "reason"),
                    })}
                    onSaved={saved}
                  />
                )}
                {n.own && n.state !== "SUBMIT" && (
                  <NoticeActionForm
                    title="Revise class announcement"
                    endpoint={`${root}/class-announcements/${n.id}/revisions`}
                    fields={[
                      { name: "title", label: "Revised title", value: n.title },
                      {
                        name: "body",
                        label: "Revised text",
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
                {(n.own && n.state === "DRAFT"
                  ? ["SUBMIT"]
                  : !n.own && n.state === "SUBMIT"
                    ? ["APPROVE", "RETURN"]
                    : n.own && n.state === "APPROVE"
                      ? ["RELEASE"]
                      : []
                ).map((action) => (
                  <NoticeActionForm
                    key={action}
                    title={`${action === "SUBMIT" ? "Submit" : action === "APPROVE" ? "Approve" : action === "RETURN" ? "Return" : "Release"} class announcement`}
                    endpoint={`${root}/class-announcements/${n.id}/decision`}
                    fields={[reason]}
                    build={(f) => ({
                      action,
                      expectedRevision: n.revision,
                      reason: text(f, "reason"),
                    })}
                    onSaved={saved}
                  />
                ))}
              </article>
            ))}
            {!view.feed.length && !view.announcements.length && (
              <p>No currently authorized class announcements.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
