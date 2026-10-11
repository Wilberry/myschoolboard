"use client";

import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="sign-out-button"
      onClick={async () => {
        await authClient.signOut();
        router.refresh();
      }}
      type="button"
    >
      Sign out
    </button>
  );
}
