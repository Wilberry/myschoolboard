import { authenticationSecurityHooks } from "./auth-security-hooks";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { env } from "@/src/lib/env";
import { prisma } from "@/src/lib/db";

export const auth = betterAuth({
  hooks: authenticationSecurityHooks,
  // Let the application boundary convert unexpected adapter errors before the
  // router can print raw database arguments through its fallback console log.
  onAPIError: { throw: true },
  // Authentication library exceptions may contain adapter arguments. Record
  // fixed diagnostic categories; immutable evidence carries safe identities.
  logger: {
    level: "warn",
    log(level) {
      console.warn(
        JSON.stringify({ event: "authentication_library_diagnostic", level }),
      );
    },
  },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.BETTER_AUTH_URL],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    cookiePrefix: "myschoolboard",
  },
});
