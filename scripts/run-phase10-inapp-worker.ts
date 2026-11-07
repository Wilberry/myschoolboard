import "dotenv/config";
import { z } from "zod";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { deliverNoticeBatch } from "@/src/modules/notifications/service";
// Local development worker: real authenticated operator, no external provider.
verifyPhase9DatabaseIdentity(process.env);
const school = z
  .string()
  .min(1)
  .max(128)
  .parse(process.env.PHASE10_WORKER_SCHOOL_ID);
const cookie = process.env.PHASE10_OPERATOR_COOKIE;
if (!cookie) throw Error("A private current operator session is required");
const args = process.argv.slice(2);
if (args.length !== 1 || !["--once", "--watch"].includes(args[0]))
  throw Error("Use --once or --watch");
process.env.PHASE10_NOTICES_ENABLED = "true";
process.env.PHASE10_INAPP_ENABLED = "true";
let stopped = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopped = true;
  });
try {
  do {
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    if (!session) throw Error("Operator session expired");
    const result = await deliverNoticeBatch(school, session.user.id);
    if (result.processed)
      console.info(
        JSON.stringify({
          event: "inapp_batch_complete",
          processed: result.processed,
          delivered: result.delivered,
        }),
      );
    if (args[0] === "--once") break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (!stopped);
} catch {
  console.error(
    "In-app worker stopped. Inspect authorized operational history.",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
