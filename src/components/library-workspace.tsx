"use client";
import { LearningAssetUploadForm } from "./learning-asset-upload-form";
import { NotificationInbox } from "./notification-inbox";
import { NoticeActionForm } from "./notice-action-form";
import { usePrivateCommunication } from "./use-private-communication";
interface Metadata {
  title: string;
  author: string;
  publisher: string;
  isbn: string | null;
  description: string;
  provenance: string;
}
interface View {
  role: string;
  assetsEnabled: boolean;
  assets: Array<{
    id: string;
    entryId: string;
    revision: number;
    own: boolean;
    verdict: string;
    catalogReleaseId: string | null;
    rightsId: string | null;
    releaseId: string | null;
    withdrawn: boolean;
  }>;
  canCurate: boolean;
  entries: Array<
    Metadata & {
      id: string;
      kind: string;
      own: boolean;
      revision: number;
      reviewAction: string | null;
      releaseId: string | null;
      withdrawn: boolean;
    }
  >;
  feed: Array<{
    id: string;
    kind: string;
    title: string;
    author: string;
    publisher: string;
    isbn: string | null;
    description: string;
    revision: number;
    assetAvailable: boolean;
    downloadHref: string | null;
  }>;
  options: Array<{ scope: string; id: string; label: string }>;
}
export function LibraryWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}/library`;
  const { view, message, panel, load, print } = usePrivateCommunication<View>(
    root + "/workspace",
  );
  const saved = () => {
      void load();
    },
    text = (f: FormData, key: string) => String(f.get(key) ?? "").trim(),
    reason = { name: "reason", label: "Decision reason" };
  const values = (f: FormData) => ({
    title: text(f, "title"),
    author: text(f, "author"),
    publisher: text(f, "publisher"),
    isbn: text(f, "isbn") || null,
    description: text(f, "description"),
    provenance: text(f, "provenance"),
    reason: text(f, "reason"),
  });
  const fields = (m?: Metadata) => [
    { name: "title", label: "Catalog title", value: m?.title },
    { name: "author", label: "Author", value: m?.author },
    { name: "publisher", label: "Publisher", value: m?.publisher },
    {
      name: "isbn",
      label: "ISBN (optional)",
      required: false,
      maxLength: 32,
      value: m?.isbn ?? "",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea" as const,
      value: m?.description,
    },
    {
      name: "provenance",
      label: "Metadata provenance",
      maxLength: 1000,
      type: "textarea" as const,
      value: m?.provenance,
    },
    reason,
  ];
  return (
    <section
      className="financial-workspace communication-workspace"
      aria-label="Approved school library catalog"
    >
      <div className="finance-toolbar finance-controls">
        <button onClick={() => void load()}>Recheck access</button>
        <button onClick={() => void print()}>Print approved catalog</button>
      </div>
      <p role="status">{message}</p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            <h2>Approved catalog</h2>
            <NotificationInbox schoolId={schoolId} channel="module" />
            <p>
              Physical book records and digital resource records are distinct.
              Catalog approval does not grant permission to distribute a file.
            </p>
            {view.feed.map((e) => (
              <article key={e.id} className="report-card">
                <h3>{e.title}</h3>
                <p>
                  {e.author} · {e.publisher}
                </p>
                <p>
                  {e.kind === "PHYSICAL_BOOK"
                    ? "Physical book catalog record"
                    : "Digital resource catalog record"}
                </p>
                <p className="notice-body">{e.description}</p>
                {e.downloadHref && (
                  <a href={e.downloadHref}>Download approved learning image</a>
                )}
                <p>
                  {e.kind === "PHYSICAL_BOOK"
                    ? "No digital file is attached to this physical book record."
                    : e.assetAvailable
                      ? "A rights-approved inspected image is available."
                      : "No approved downloadable asset is available."}
                </p>
              </article>
            ))}
            {!view.feed.length && (
              <p>No currently authorized approved catalog records.</p>
            )}
            <div className="finance-controls">
              {view.canCurate && (
                <NoticeActionForm
                  title="Propose catalog record"
                  endpoint={root + "/catalog"}
                  fields={[
                    {
                      name: "kind",
                      label: "Record type",
                      type: "select",
                      options: [
                        { value: "PHYSICAL_BOOK", label: "Physical book" },
                        {
                          value: "DIGITAL_RESOURCE",
                          label: "Digital resource",
                        },
                      ],
                    },
                    ...fields(),
                  ]}
                  build={(f) => ({ ...values(f), kind: text(f, "kind") })}
                  onSaved={saved}
                />
              )}
              {view.entries.map((e) => (
                <article
                  className="report-card"
                  key={e.id}
                  aria-label={`Managed catalog record ${e.id}`}
                >
                  <h3>{e.title}</h3>
                  <p>
                    Revision {e.revision}:{" "}
                    {e.reviewAction ?? "Awaiting independent review"}
                  </p>
                  <p className="notice-body">{e.description}</p>
                  {view.assetsEnabled &&
                    e.own &&
                    e.kind === "DIGITAL_RESOURCE" && (
                      <LearningAssetUploadForm
                        schoolId={schoolId}
                        entryId={e.id}
                        revision={e.revision}
                        onSaved={saved}
                      />
                    )}
                  {e.own && (
                    <NoticeActionForm
                      title="Revise catalog metadata"
                      endpoint={`${root}/catalog/${e.id}/revisions`}
                      fields={fields(e)}
                      build={(f) => ({
                        ...values(f),
                        expectedRevision: e.revision,
                      })}
                      onSaved={saved}
                    />
                  )}
                  {view.role === "SCHOOL_SUPER_ADMIN" &&
                    !e.own &&
                    !e.reviewAction &&
                    ["APPROVE", "RETURN"].map((action) => (
                      <NoticeActionForm
                        key={action}
                        title={
                          action === "APPROVE"
                            ? "Approve catalog metadata"
                            : "Return catalog metadata"
                        }
                        endpoint={`${root}/catalog/${e.id}/reviews`}
                        fields={[reason]}
                        build={(f) => ({
                          action,
                          expectedRevision: e.revision,
                          reason: text(f, "reason"),
                        })}
                        onSaved={saved}
                      />
                    ))}
                  {view.role === "SCHOOL_SUPER_ADMIN" &&
                    e.reviewAction === "APPROVE" &&
                    !e.releaseId && (
                      <NoticeActionForm
                        title="Release approved catalog metadata"
                        endpoint={`${root}/catalog/${e.id}/releases`}
                        fields={[
                          {
                            name: "target",
                            label: "Permitted catalog audience",
                            type: "select",
                            options: [
                              {
                                value: "SCHOOL",
                                label:
                                  "School staff and verified enrolled students",
                              },
                              ...view.options.map((o) => ({
                                value: o.scope + ":" + o.id,
                                label: o.scope + ": " + o.label,
                              })),
                            ],
                          },
                          reason,
                        ]}
                        build={(f) => {
                          const [scope, target] = text(f, "target").split(":");
                          return {
                            expectedRevision: e.revision,
                            scope,
                            ...(scope === "SECTION"
                              ? { sectionId: target }
                              : scope === "CLASS"
                                ? { classId: target }
                                : scope === "STUDENT"
                                  ? { studentId: target }
                                  : {}),
                            reason: text(f, "reason"),
                          };
                        }}
                        onSaved={saved}
                      />
                    )}
                  {view.role === "SCHOOL_SUPER_ADMIN" &&
                    e.releaseId &&
                    !e.withdrawn && (
                      <NoticeActionForm
                        title="Withdraw catalog release"
                        endpoint={`${root}/catalog-releases/${e.releaseId}/withdraw`}
                        fields={[reason]}
                        build={(f) => ({ reason: text(f, "reason") })}
                        onSaved={saved}
                      />
                    )}
                </article>
              ))}
            </div>
            {view.assetsEnabled && (
              <div className="finance-controls">
                <h2>Private learning image review</h2>
                {view.assets.map((a) => (
                  <article
                    className="report-card"
                    key={a.id}
                    aria-label={`Learning asset ${a.id}`}
                  >
                    <h3>Image inspection: {a.verdict}</h3>
                    <p>
                      Catalog revision {a.revision}. Independent rights and
                      explicit release are required.
                    </p>
                    {view.role === "SCHOOL_SUPER_ADMIN" &&
                      !a.own &&
                      a.catalogReleaseId && (
                        <NoticeActionForm
                          title="Attest learning image rights"
                          endpoint={`${root}/assets/${a.id}/rights`}
                          fields={[
                            {
                              name: "basis",
                              label: "Rights basis",
                              type: "select",
                              options: [
                                { value: "OWNED", label: "Owned rights" },
                                { value: "LICENSED", label: "Licensed use" },
                                {
                                  value: "OPEN_LICENSE",
                                  label: "Open license",
                                },
                                {
                                  value: "PUBLIC_DOMAIN",
                                  label: "Public domain",
                                },
                              ],
                            },
                            {
                              name: "sourceLicense",
                              label:
                                "Rights source, license and permitted audience",
                              type: "textarea",
                              maxLength: 1000,
                            },
                            {
                              name: "expiresAt",
                              label: "Rights expiry (UTC, optional)",
                              type: "datetime-local",
                              required: false,
                            },
                            reason,
                          ]}
                          build={(f) => ({
                            catalogReleaseId: a.catalogReleaseId,
                            basis: text(f, "basis"),
                            sourceLicense: text(f, "sourceLicense"),
                            permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
                            expiresAt: text(f, "expiresAt")
                              ? new Date(
                                  text(f, "expiresAt") + "Z",
                                ).toISOString()
                              : null,
                            reason: text(f, "reason"),
                          })}
                          onSaved={saved}
                        />
                      )}
                    {view.role === "SCHOOL_SUPER_ADMIN" &&
                      a.verdict === "CLEAN" &&
                      a.rightsId &&
                      !a.releaseId && (
                        <NoticeActionForm
                          title="Release rights-approved learning image"
                          endpoint={`${root}/assets/${a.id}/releases`}
                          fields={[reason]}
                          build={(f) => ({
                            rightsId: a.rightsId,
                            reason: text(f, "reason"),
                          })}
                          onSaved={saved}
                        />
                      )}
                    {view.role === "SCHOOL_SUPER_ADMIN" &&
                      a.releaseId &&
                      !a.withdrawn && (
                        <NoticeActionForm
                          title="Withdraw learning image"
                          endpoint={`${root}/asset-releases/${a.releaseId}/withdraw`}
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
      </div>
    </section>
  );
}
