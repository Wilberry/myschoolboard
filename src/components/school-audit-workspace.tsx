"use client";
import { useState } from "react";
import { usePrivateCommunication } from "./use-private-communication";
interface Evidence {
  id: string;
  source: string;
  at: string;
  action: string;
  actorUserId: string | null;
}
export function SchoolAuditWorkspace({ schoolId }: { schoolId: string }) {
  const [cursor, setCursor] = useState<string>();
  const { view, panel, message, load } = usePrivateCommunication<{
    events: Evidence[];
    nextCursor: string | null;
  }>(
    `/api/schools/${encodeURIComponent(schoolId)}/audit${cursor ? "?cursor=" + encodeURIComponent(cursor) : ""}`,
  );
  return (
    <section
      className="financial-workspace communication-workspace"
      aria-label="School audit evidence"
    >
      <div className="finance-toolbar finance-controls">
        <button onClick={() => void load()}>Recheck access</button>
        {cursor && (
          <button onClick={() => setCursor(undefined)}>Newest evidence</button>
        )}
      </div>
      <p role="status">{message}</p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            <p>
              Immutable source references and actors. Academic content, pupil
              work, payment details and free-text reasons are excluded. This
              view covers registered school sources; it is not a complete
              authentication/security audit.
            </p>
            {!view.events.length && <p>No registered school evidence.</p>}
            <ol>
              {view.events.map((event) => (
                <li key={event.source + event.id}>
                  <article>
                    <h2>
                      {event.source}: {event.action}
                    </h2>
                    <p>Source reference: {event.id}</p>
                    <p>
                      Recorded: <time dateTime={event.at}>{event.at}</time>
                    </p>
                    <p>
                      Actor reference:{" "}
                      {event.actorUserId ?? "Not recorded by source"}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
            {view.nextCursor && (
              <button
                className="finance-controls"
                onClick={() => setCursor(view.nextCursor!)}
              >
                Older evidence
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
