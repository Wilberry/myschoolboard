import { Suspense, type ReactNode } from "react";

/**
 * School pages contain request-bound authorization and tenant-scoped reads.
 * The fallback is deliberately school-neutral: only each child page may
 * disclose school data after its existing server-side checks pass.
 *
 * This boundary does not grant school access or cache any private response.
 */
export default function SchoolWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className="workspace">
          <p className="workspace-note" role="status">
            Checking school access…
          </p>
        </main>
      }
    >
      {children}
    </Suspense>
  );
}
