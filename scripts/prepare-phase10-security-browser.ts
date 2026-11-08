import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
verifyPhase9DatabaseIdentity(process.env);
const [operation, file, ...extra] = process.argv.slice(2);
assert.ok(!extra.length && ["--create", "--revoke"].includes(operation));
assert.match(file ?? "", /^\/tmp\/phase10-security-[\w-]+\.json$/);
try {
  if (operation === "--create") {
    const tag = randomUUID(),
      school = `p10-security-browser-${tag}`,
      password = `Synthetic-only-${randomUUID()}`;
    const users: Record<string, string> = {},
      emails: Record<string, string> = {};
    for (const name of ["owner", "operator", "foreign"]) {
      const email = `p10-security-browser-${name}-${tag}@example.test`;
      const made = await auth.api.signUpEmail({
        body: { email, password, name: "Synthetic security browser actor" },
      });
      users[name] = made.user.id;
      emails[name] = email;
    }
    await prisma.user.update({
      where: { id: users.operator },
      data: { platformRole: "SUPER_ADMIN" },
    });
    await prisma.school.create({
      data: {
        id: school,
        slug: school,
        name: "Synthetic security browser school",
      },
    });
    await prisma.membership.create({
      data: {
        userId: users.owner,
        schoolId: school,
        role: "SCHOOL_SUPER_ADMIN",
      },
    });
    await writeFile(
      file,
      JSON.stringify({ tag, school, password, users, emails }),
      { mode: 0o600, flag: "wx" },
    );
    console.log("Fresh synthetic account security browser actors prepared");
  } else {
    const f = JSON.parse(await readFile(file, "utf8"));
    assert.match(f.tag, /^[0-9a-f-]{36}$/);
    assert.equal(f.school, `p10-security-browser-${f.tag}`);
    assert.equal(
      f.emails.operator,
      `p10-security-browser-operator-${f.tag}@example.test`,
    );
    assert.ok(await prisma.school.findUnique({ where: { id: f.school } }));
    const actor = await prisma.user.findUniqueOrThrow({
      where: { id: f.users.operator },
    });
    assert.equal(actor.email, f.emails.operator);
    assert.equal(actor.platformRole, "SUPER_ADMIN");
    await prisma.user.update({
      where: { id: actor.id },
      data: { platformRole: "NONE" },
    });
    console.log("Synthetic operator platform authority revoked");
  }
} finally {
  await prisma.$disconnect();
}
