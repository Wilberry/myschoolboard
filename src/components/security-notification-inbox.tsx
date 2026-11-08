"use client";
import { useState } from "react";
import Link from "next/link";
import { usePrivateCommunication } from "./use-private-communication";
import { NoticeActionForm } from "./notice-action-form";
interface Inbox {
  items: Array<{
    id: string;
    read: boolean;
    createdAt: string;
    text: string;
    href: string;
  }>;
  nextCursor: string | null;
  unreadCount: string;
}
export function SecurityNotificationInbox({
  platform = false,
}: {
  platform?: boolean;
}) {
  const [cursor, setCursor] = useState<string>();
  const root = platform
    ? "/api/platform/security-notifications"
    : "/api/account/security-notifications";
  const { view, panel, load } = usePrivateCommunication<Inbox>(
    root + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
    true,
  );
  return (
    <section
      className="finance-controls"
      aria-label={
        platform
          ? "Platform security notifications"
          : "Account security notifications"
      }
    >
      <h2>
        {platform ? "Platform security alerts" : "Your security notifications"}
      </h2>
      <p>Reading an alert does not change account access.</p>
      <button onClick={() => void load()}>Recheck notifications</button>
      <p role="status" aria-live="polite">
        {view
          ? "Current security notifications loaded."
          : "Security notifications are concealed. Recheck access to continue."}
      </p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            <p>Unread security notifications: {view.unreadCount}</p>
            {!view.items.length && (
              <p>No currently authorized security notifications.</p>
            )}
            {view.items.map((item) => (
              <article
                className="report-card"
                key={item.id}
                aria-label={`Security notification ${item.id}`}
              >
                <h3>{item.text}</h3>
                <p>
                  {item.read ? "Read" : "Unread"} ·{" "}
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString("en-NG")}
                  </time>
                </p>
                <Link href={item.href}>Open current security records</Link>
                <NoticeActionForm
                  title={item.read ? "Mark unread" : "Mark read"}
                  endpoint={`${root}/${item.id}/state`}
                  fields={[]}
                  onSaved={() => void load()}
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
