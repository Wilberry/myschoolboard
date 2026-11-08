"use client";
import { usePrivateTrash } from "./use-private-trash";
import { FinanceOperationForm } from "./finance-operation-form";
import type { TrashRow } from "@/src/modules/trash/service";
export function TrashWorkspace({ schoolId }: { schoolId?: string }) {
  const platform = !schoolId;
  const endpoint = platform
    ? "/api/platform/trash"
    : `/api/schools/${encodeURIComponent(schoolId!)}/trash`;
  const { view, message, panel, load } = usePrivateTrash<{
    items: TrashRow[];
    candidates?: Array<{ id: string; topic: string }>;
    role?: string;
  }>(endpoint);
  const saved = () => {
    void load();
  };
  const reason = { name: "reason", label: "Lifecycle reason" };
  return (
    <section className="financial-workspace" aria-label="Trash and recovery">
      <button onClick={() => void load()}>Recheck access</button>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            <h2>{platform ? "Platform trash metadata" : "School trash"}</h2>
            <p>
              School recovery lasts 30 days. Platform retention lasts 90 days
              from transfer. Only never-submitted lesson drafts are supported.
              Academic and audit history is preserved; this workspace never
              physically erases records.
            </p>
            {platform && (
              <p>
                Platform access is metadata only. Recovery authorization
                provides a school-scoped 24-hour recovery opportunity within the
                original platform deadline. It does not grant academic content
                access.
              </p>
            )}
            {!platform && !!view.candidates?.length && (
              <FinanceOperationForm
                title="Move draft to school trash"
                endpoint={endpoint}
                onSaved={saved}
                fields={[
                  {
                    name: "noteId",
                    label: "Never-submitted draft",
                    type: "select",
                    options: view.candidates.map((n) => ({
                      value: n.id,
                      label: n.topic,
                    })),
                  },
                  reason,
                ]}
                build={(f) => ({
                  action: "TRASH",
                  noteId: f.get("noteId"),
                  reason: f.get("reason"),
                })}
              />
            )}
            {!view.items.length && (
              <p>No currently authorized trash records are available.</p>
            )}
            {view.items.map((item) => (
              <article
                className="report-card"
                key={item.id}
                aria-label={`Trash record ${item.id}`}
              >
                <h3>Lesson draft lifecycle record</h3>
                <p>Record: {item.id}</p>
                <p>
                  State: {item.state}; version {item.version}. Hold:{" "}
                  {item.legalHold ? "active" : "none"}.
                </p>
                <p>
                  School recovery deadline:{" "}
                  {new Date(item.schoolExpiresAt).toLocaleString("en-NG")}
                </p>
                {item.platformExpiresAt && (
                  <p>
                    Platform deadline:{" "}
                    {new Date(item.platformExpiresAt).toLocaleString("en-NG")}
                  </p>
                )}
                {item.recoveryExpiresAt && (
                  <p>
                    Authorized recovery until:{" "}
                    {new Date(item.recoveryExpiresAt).toLocaleString("en-NG")}
                  </p>
                )}
                {item.state === "PURGE_BLOCKED" && (
                  <p>
                    Retention expired. Physical purge is blocked because this
                    adapter preserves protected academic and audit history. An
                    authorized retention disposition is required.
                  </p>
                )}
                {(platform
                  ? ["PLATFORM"].includes(item.state)
                    ? [
                        "AUTHORIZE_RECOVERY",
                        item.legalHold ? "RELEASE_HOLD" : "HOLD",
                      ]
                    : [item.legalHold ? "RELEASE_HOLD" : "HOLD"]
                  : [
                      "RESTORE",
                      ...(view.role === "SCHOOL_SUPER_ADMIN"
                        ? ["REMOVE_SCHOOL"]
                        : []),
                    ]
                ).map((action) => (
                  <FinanceOperationForm
                    key={action}
                    title={
                      action === "AUTHORIZE_RECOVERY"
                        ? "Authorize scoped recovery"
                        : action === "REMOVE_SCHOOL"
                          ? "End school recovery"
                          : action === "RESTORE"
                            ? "Restore draft"
                            : action === "HOLD"
                              ? "Place legal hold"
                              : "Release legal hold"
                    }
                    endpoint={endpoint}
                    onSaved={saved}
                    fields={[reason]}
                    build={(f) => ({
                      action,
                      caseId: item.id,
                      expectedVersion: item.version,
                      reason: f.get("reason"),
                      ...(platform ? { schoolId: item.schoolId } : {}),
                    })}
                  />
                ))}
              </article>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
