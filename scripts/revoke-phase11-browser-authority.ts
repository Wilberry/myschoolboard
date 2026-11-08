import "dotenv/config";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
import { prisma } from "@/src/lib/db";
verifyPhase9DatabaseIdentity(process.env);
const [file, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(file ?? "", /^\/tmp\/phase11-[\w-]+\.json$/);
try {
  const f = JSON.parse(await readFile(file, "utf8"));
  assert.equal(f.school, `p11-school-${f.tag}`);
  const note = await prisma.lessonNote.findFirstOrThrow({
    where: { id: f.noteId, schoolId: f.school },
    select: { assignmentId: true, teacherMembershipId: true },
  });
  assert.equal(note.teacherMembershipId, f.members.teacher);
  const member = await prisma.membership.findUniqueOrThrow({
    where: { id: f.members.teacher },
  });
  assert.equal(member.schoolId, f.school);
  assert.equal(member.userId, f.users.teacher);
  const changed = await prisma.teacherClassSubjectAssignment.updateMany({
    where: {
      id: note.assignmentId,
      schoolId: f.school,
      membershipId: member.id,
      status: "ACTIVE",
    },
    data: { status: "REVOKED" },
  });
  assert.equal(changed.count, 1);
  console.log(JSON.stringify({ rowCount: changed.count }));
} finally {
  await prisma.$disconnect();
}
