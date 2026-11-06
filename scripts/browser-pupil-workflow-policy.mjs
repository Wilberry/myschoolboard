import { isLoopbackBrowserOrigin } from "./browser-fixture-safety.mjs";

const phases = new Set(["prepare", "verify", "revoke"]);

export function assertBrowserPupilWorkflowPolicy(
  phase,
  environment = process.env,
) {
  if (!phases.has(phase)) {
    throw new Error("Phase must be prepare, verify or revoke");
  }
  if (!isLoopbackBrowserOrigin(environment.BETTER_AUTH_URL)) {
    throw new Error("Browser workflow requires loopback Better Auth origin");
  }
  if (phase !== "verify" && environment.BROWSER_PUPIL_WORKFLOW_WRITE !== "1") {
    throw new Error("Explicit synthetic pupil workflow opt-in is required");
  }
  if (phase === "revoke" && environment.BROWSER_PUPIL_REVOKE !== "1") {
    throw new Error("Student revocation requires separate explicit opt-in");
  }
  return phase;
}
