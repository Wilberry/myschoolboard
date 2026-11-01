import { assertLocalVerificationTarget } from "./verify-local.mjs";

const runPattern = /^[a-z][a-z0-9-]{5,25}$/;

/**
 * This policy only authorizes synthetic browser fixture creation on the
 * existing protected local test target. It never authorizes production roles.
 */
export function assertPhase3BrowserFixturePolicy(environment = process.env) {
  assertLocalVerificationTarget(environment);
  if (environment.PHASE3_BROWSER_FIXTURE_WRITE !== "1") {
    throw new Error("Explicit Phase 3 synthetic fixture write opt-in required");
  }
  const runId = environment.PHASE3_BROWSER_RUN_ID;
  if (typeof runId !== "string" || !runPattern.test(runId)) {
    throw new Error("Use a new lowercase Phase 3 browser run ID");
  }
  const password = environment.PHASE3_BROWSER_PASSWORD;
  if (
    typeof password !== "string" ||
    password.length < 16 ||
    password === environment.DEV_ADMIN_PASSWORD ||
    password === environment.BROWSER_FIXTURE_PASSWORD
  ) {
    throw new Error("A distinct synthetic browser-only password is required");
  }
  return {
    runId,
    operatorEmail: `phase3-${runId}-operator@myschoolboard.test`,
    schoolAdminEmail: `phase3-${runId}-schooladmin@myschoolboard.test`,
    schoolSlugs: [`phase3-${runId}-a`, `phase3-${runId}-b`],
  };
}
