import "dotenv/config";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { captureSubscriptionBoundariesForActor } from "@/src/modules/notifications/subscription-boundaries";
// Development only. An operator's current session is reauthenticated every pass.
verifyPhase9DatabaseIdentity(process.env);
const cookie = process.env.PHASE10_OPERATOR_COOKIE;
const args = process.argv.slice(2);
if (!cookie || args.length !== 1 || !["--once", "--watch"].includes(args[0]))
  throw Error("A private operator session and --once or --watch are required");
process.env.PHASE10_SUBSCRIPTION_BOUNDARIES_ENABLED = "true";
let stopped = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopped = true;
  });
try {
  do {
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    if (!session) throw Error("Operator session expired");
    const result = await captureSubscriptionBoundariesForActor(session.user.id);
    console.info(
      JSON.stringify({
        event: "subscription_boundary_batch_complete",
        ...result,
      }),
    );
    if (args[0] === "--once") break;
    await new Promise((resolve) =>
      setTimeout(resolve, result.more ? 1000 : 30000),
    );
  } while (!stopped);
} catch {
  console.error(
    "Boundary worker stopped; inspect authorized operational evidence.",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
