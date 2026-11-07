// Test fixture control only. No reset, reactivation, generic SQL or real data.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import pg from "pg";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
verifyPhase9DatabaseIdentity(process.env);
const [file, operation, eventId] = process.argv.slice(2);
assert.match(file ?? "", /^\/tmp\/phase10-[\w-]+\.json$/);
const f = JSON.parse(await readFile(file, "utf8"));
assert.match(f.school, /^p10-notices-/);
assert.match(f.tag, /^[a-f0-9-]{36}$/);
assert.ok(
  [
    "revoke-student-membership",
    "end-pupil-enrollment",
    "stage-delivery-failures",
  ].includes(operation),
);
if (operation === "stage-delivery-failures") {
  assert.match(eventId ?? "", /^[a-f0-9-]{36}$/);
  process.env.PHASE10_NOTICES_ENABLED = "true";
  process.env.PHASE10_INAPP_ENABLED = "true";
  const { prisma } = await import("../src/lib/db.ts");
  const { claimNoticeEvent, failNoticeClaim } =
    await import("../src/modules/notifications/service.ts");
  try {
    for (let i = 0; i < 5; i++) {
      const claim = await claimNoticeEvent(f.school, f.users.owner);
      assert.equal(claim?.eventId, eventId);
      assert.equal(
        (await failNoticeClaim(claim, f.users.owner)).recorded,
        true,
      );
      if (i < 4)
        await prisma.outboxDispatch.update({
          where: { eventId },
          data: { nextAttemptAt: new Date(0) },
        });
    }
    assert.equal(
      (await prisma.outboxDispatch.findUniqueOrThrow({ where: { eventId } }))
        .state,
      "DEAD_LETTER",
    );
    console.log("Synthetic delivery failure evidence verified");
  } finally {
    await prisma.$disconnect();
  }
  process.exit(0);
}

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await db.connect();
try {
  await db.query("BEGIN");
  const school = await db.query(
    'SELECT "id" FROM "School" WHERE "id"=$1 FOR UPDATE',
    [f.school],
  );
  assert.equal(school.rowCount, 1);
  if (operation === "revoke-student-membership") {
    const member = await db.query(
      'UPDATE "Membership" SET "isActive"=false WHERE "schoolId"=$1 AND "id"=$2 AND "userId"=$3 AND "role"=\'STUDENT\' AND "isActive"',
      [f.school, f.members.browserstudent, f.users.browserstudent],
    );
    assert.equal(member.rowCount, 1);
  } else {
    const ended = await db.query(
      'UPDATE "StudentEnrollment" SET "status"=\'ENDED\',"endedAt"=clock_timestamp() WHERE "schoolId"=$1 AND "studentId"=$2 AND "status"=\'ACTIVE\'',
      [f.school, f.pupilId],
    );
    assert.equal(ended.rowCount, 1);
  }
  await db.query("COMMIT");
  console.log("Terminal synthetic fixture transition verified");
} catch (e) {
  await db.query("ROLLBACK");
  throw e;
} finally {
  await db.end();
}
