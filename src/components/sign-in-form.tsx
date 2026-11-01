"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import { authRequestSucceeded } from "@/src/lib/auth-action";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    if (pending) return;
    setPending(true);
    setError(null);

    const success = await authRequestSucceeded(() =>
      authClient.signIn.email({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
      }),
    );
    setPending(false);

    if (!success) {
      setError(
        "Sign-in failed. Check your credentials or connection and try again.",
      );
      return;
    }

    router.refresh();
  }

  return (
    <form
      className="sign-in-form"
      action={(formData) => void submit(formData)}
      aria-label="Sign in"
    >
      <label>
        Email address
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
