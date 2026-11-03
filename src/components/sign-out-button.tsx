"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import { authRequestSucceeded } from "@/src/lib/auth-action";
import { announceSessionSignOut } from "@/src/lib/auth-session-events";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (pending) return;
    announceSessionSignOut();
    setPending(true);
    setError(null);

    const success = await authRequestSucceeded(() => authClient.signOut());
    setPending(false);

    if (!success) {
      setError("Sign-out failed. Check your connection and try again.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        className="sign-out-button"
        onClick={() => void signOut()}
        type="button"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Signing out..." : "Sign out"}
      </button>
      {error && (
        <span className="sign-out-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
