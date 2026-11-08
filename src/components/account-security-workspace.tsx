"use client";
import { useState } from "react";
import { usePrivateCommunication } from "./use-private-communication";
const labels: Record<string, string> = {
  SESSION_CREATED: "Session started",
  SESSION_CHANGED: "Session changed",
  SESSION_ENDED: "Session ended",
  AUTH_SUCCEEDED: "Sign-in succeeded",
  AUTH_FAILED: "Authentication failed",
  LOGOUT_REQUESTED: "Sign-out requested",
  LOGOUT_COMPLETED: "Sign-out completed",
  LOGOUT_FAILED: "Sign-out could not be completed",
};
interface Evidence {
  id: string;
  kind: string;
  at: string;
  method: string;
  subjectUserId: string | null;
  actorUserId: string | null;
}
export function AccountSecurityWorkspace({
  platform = false,
}: {
  platform?: boolean;
}) {
  const [cursor, setCursor] = useState<string>();
  const root = platform
    ? "/api/platform/security-evidence"
    : "/api/account/security-evidence";
  const { view, panel, message, load } = usePrivateCommunication<{
    evidence: Evidence[];
    nextCursor: string | null;
  }>(root + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""), true);
  return (
    <section
      className="financial-workspace communication-workspace"
      aria-label={
        platform
          ? "Platform security evidence"
          : "Your account security evidence"
      }
    >
      <div className="finance-toolbar finance-controls">
        <button onClick={() => void load()}>Recheck access</button>
        {cursor && (
          <button onClick={() => setCursor(undefined)}>Newest evidence</button>
        )}
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div ref={panel} hidden={!view}>
        {view && (
          <>
            <p>
              {platform
                ? "Restricted account-security metadata. Unknown authentication failures are not assigned to a school."
                : "Only your account’s security activity appears here."}
            </p>
            {!view.evidence.length && <p>No account security evidence.</p>}
            <ol>
              {view.evidence.map((event) => (
                <li key={event.id}>
                  <article aria-label={`Security event ${event.id}`}>
                    <h2>{labels[event.kind] ?? "Account security update"}</h2>
                    <p>
                      Recorded:{" "}
                      <time dateTime={event.at}>
                        {new Date(event.at).toLocaleString("en-NG")}
                      </time>
                    </p>
                    {platform && (
                      <p>
                        Account reference:{" "}
                        {event.subjectUserId ?? "Identity not established"}
                      </p>
                    )}
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
