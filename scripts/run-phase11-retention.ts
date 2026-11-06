import "dotenv/config";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
import { auth } from "@/src/lib/auth";
import { expireTrashBatch } from "@/src/modules/trash/service";
import { prisma } from "@/src/lib/db";
// Development-only operator command. Attest while all write flags are off.
verifyPhase9DatabaseIdentity(process.env);
const cookie = process.env.PHASE11_OPERATOR_COOKIE;
if (!cookie)
  throw Error("A current authenticated platform operator session is required");
const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
if (!session) throw Error("Current operator authentication required");
process.env.PHASE11_TRASH_ENABLED = "true";
try {
  const result = await expireTrashBatch(session.user.id);
  console.info(
    JSON.stringify({
      event: "retention_batch_complete",
      processed: result.processed,
      physicalDeletes: 0,
    }),
  );
} finally {
  await prisma.$disconnect();
}
