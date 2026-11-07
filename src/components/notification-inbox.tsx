"use client";
import { useState } from "react";
import Link from "next/link";
import { usePrivateCommunication } from "./use-private-communication";
import { NoticeActionForm } from "./notice-action-form";
interface InboxView {
  items: Array<{
    id: string;
    createdAt: string;
    read: boolean;
    text: string;
    href: string;
  }>;
  nextCursor: string | null;
  unreadCount: string;
}
export function NotificationInbox({
  schoolId,
  channel = "notice",
}: {
  schoolId: string;
  channel?: "notice" | "class";
}) {
  const [cursor, setCursor] = useState<string | undefined>();
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const { view, message, panel, load } = usePrivateCommunication<InboxView>(
    `${root}/${channel === "class" ? "class-notifications" : "notifications"}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
  const refresh = () => {
    void load();
  };
  return (
    <section
      className="finance-controls"
      aria-label="In-app notification inbox"
    >
      <h2>In-app notifications</h2>
      <p>
        Reading a notification does not acknowledge or approve any school
        record.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            <p role="status">Unread notifications: {view.unreadCount}</p>
            {!view.items.length && (
              <p>No currently authorized notifications.</p>
            )}
            {view.items.map((item) => (
              <article
                key={item.id}
                aria-label={`Notification ${item.id}`}
                className="report-card"
              >
                <h3>{item.text}</h3>
                <p>
                  {item.read ? "Read" : "Unread"} ·{" "}
                  {new Date(item.createdAt).toLocaleString("en-NG")}
                </p>
                <Link href={item.href}>
                  {channel === "class"
                    ? "Open class announcement"
                    : "Open school notice"}
                </Link>
                <NoticeActionForm
                  title={item.read ? "Mark unread" : "Mark read"}
                  endpoint={`${root}/${channel === "class" ? "class-notifications" : "notifications"}/${item.id}/state`}
                  fields={[]}
                  onSaved={refresh}
                  build={() => ({ action: item.read ? "UNREAD" : "READ" })}
                />
              </article>
            ))}
            <div className="finance-toolbar">
              {cursor && (
                <button onClick={() => setCursor(undefined)}>
                  Newest notifications
                </button>
              )}
              {view.nextCursor && (
                <button onClick={() => setCursor(view.nextCursor!)}>
                  Older notifications
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
