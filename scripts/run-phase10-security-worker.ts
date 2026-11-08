import "dotenv/config";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
import { currentLocalWorkerUser } from "@/src/modules/notifications/local-worker-session";
import { prisma } from "@/src/lib/db";
import { deliverSecurityBatchForActor } from "@/src/modules/notifications/security-inapp";
verifyPhase9DatabaseIdentity(process.env);
const cookie = process.env.PHASE10_OPERATOR_COOKIE,
  args = process.argv.slice(2);
if (!cookie || args.length !== 1 || !["--once", "--watch"].includes(args[0]))
  throw Error(
    "A private current operator session and --once or --watch are required",
  );
process.env.PHASE10_AUTH_SECURITY_ENABLED = "true";
process.env.PHASE10_SECURITY_INAPP_ENABLED = "true";
process.env.PHASE10_INAPP_ENABLED = "true";
let stopped = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopped = true;
  });
try {
  do {
    const userId = await currentLocalWorkerUser(cookie);
    const result = await deliverSecurityBatchForActor(userId);
    console.info(
      JSON.stringify({ event: "security_inapp_batch_complete", ...result }),
    );
    if (args[0] === "--once") break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (!stopped);
} catch {
  console.error(
    "Security worker stopped; inspect authorized delivery evidence.",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
