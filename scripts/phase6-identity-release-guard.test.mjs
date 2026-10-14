import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const identitySQL = read(
  "../prisma/migrations/20261012240000_student_account_identity/migration.sql",
);
const kindSQL = read(
  "../prisma/migrations/20261012250000_lesson_scheme_kind/migration.sql",
);
const noteReader = read("../src/modules/lesson-notes/student-reader.ts");
const linking = read("../src/modules/students/account-link-service.ts");
const teaching = read("../src/modules/lesson-notes/service.ts");
const releaseSQL = read(
  "../prisma/migrations/20261012230000_lesson_approved_release/migration.sql",
);

test("student binding is one to one, explicitly attested, and has terminal revocation", () => {
  assert.match(schema, /model StudentAccountLink \{/);
  assert.match(schema, /@@unique\(\[schoolId, studentId\]\)/);
  assert.match(schema, /@@unique\(\[schoolId, studentMembershipId\]\)/);
  assert.match(schema, /model StudentAccountLinkRevocation \{/);
  assert.match(identitySQL, /"StudentAccountLink_validate"/);
  assert.match(identitySQL, /"StudentAccountLinkRevocation_validate"/);
  assert.match(identitySQL, /"role"='STUDENT'/);
  assert.match(
    identitySQL,
    /"role" IN \('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN'\)/,
  );
  assert.match(identitySQL, /"StudentAccountLink_immutable"/);
  assert.match(identitySQL, /"StudentAccountLinkRevocation_immutable"/);
  assert.match(linking, /identityVerified: z\.literal\(true\)/);
  assert.doesNotMatch(linking, /findFirst\(\{\s*where:\s*\{\s*email/);
});

test("student lesson content query joins the actual enrolled pupil and release", () => {
  for (const name of [
    '"StudentAccountLink"',
    '"StudentAccountLinkRevocation"',
    '"StudentRecord"',
    '"StudentEnrollment"',
    '"AcademicSession"',
    '"AcademicTerm"',
    '"LessonNoteRevision"',
    '"LessonReleaseEvent"',
    '"LessonNoteEvent"',
  ])
    assert.ok(noteReader.includes(name), name);
  assert.match(noteReader, /enrollment\."status" = 'ACTIVE'/);
  assert.match(noteReader, /member\."role" = 'STUDENT'/);
  assert.match(noteReader, /n\."status" = 'APPROVED'/);
  assert.match(noteReader, /released\."eventType" = 'RELEASED'/);
  assert.match(noteReader, /withdrawn\."eventType" = 'WITHDRAWN'/);
  assert.match(noteReader, /revocation\."id" IS NULL/);
  assert.match(noteReader, /revision\."revisionNumber" = n\."currentRevision"/);
});

test("schemes share audited note approval/release but have immutable week ranges", () => {
  assert.match(schema, /enum LessonDocumentKind \{/);
  assert.match(schema, /SCHEME_OF_WORK/);
  assert.match(kindSQL, /"LessonNote_scheme_week_check"/);
  assert.match(kindSQL, /"LessonNote_kind_immutable"/);
  assert.match(kindSQL, /"weekStart" BETWEEN 1 AND 53/);
  assert.match(kindSQL, /"weekEnd" BETWEEN "weekStart" AND 53/);
  assert.match(
    teaching,
    /kind: z\.enum\(\["LESSON_NOTE", "SCHEME_OF_WORK"\]\)/,
  );
  assert.match(releaseSQL, /"LessonReleaseEvent_validate"/);
  assert.match(releaseSQL, /"eventType"='RELEASED'|eventType" = 'RELEASED'/);
});

test("additive migrations never bulk-link by names or rewrite lesson content", () => {
  assert.doesNotMatch(
    identitySQL,
    /\b(?:UPDATE\s+"StudentRecord"|DELETE\s+FROM|TRUNCATE\s+TABLE|DROP\s+TABLE)\b/i,
  );
  assert.doesNotMatch(
    kindSQL,
    /\b(?:DELETE\s+FROM|DROP\s+TABLE|TRUNCATE\s+TABLE|UPDATE\s+"LessonNoteRevision")\b/i,
  );
});
