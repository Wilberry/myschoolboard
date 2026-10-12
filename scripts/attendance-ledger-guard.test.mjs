import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const ledger = readFileSync(
  new URL("../prisma/migrations/20261012180000_attendance_register_ledger/migration.sql", import.meta.url), "utf8");
const corrections = readFileSync(
  new URL("../prisma/migrations/20261012190000_attendance_immutable_corrections/migration.sql", import.meta.url), "utf8");
const hardening = readFileSync(
  new URL("../prisma/migrations/20261012200000_attendance_complete_roster_guard/migration.sql", import.meta.url), "utf8");

test("submission has a PostgreSQL complete-roster event guard, independent of HTTP", () => {
  assert.match(hardening, /CREATE TRIGGER "AttendanceEvent_complete_roster"/);
  assert.match(hardening, /BEFORE INSERT ON "AttendanceEvent"/);
  assert.match(hardening, /NEW\."eventType" <> 'SUBMITTED'/);
  assert.match(hardening, /FOR UPDATE/);
  assert.match(hardening, /total_marks\s*<>\s*eligible_students/);
  assert.match(hardening, /total_marks\s*<>\s*eligible_marks/);
  assert.match(hardening, /total_marks\s*>\s*500/);
  assert.match(hardening, /enrollment\."status" = 'ACTIVE'/);
  assert.match(hardening, /pupil\."status" = 'ENROLLED'/);
});

test("existing unique class/date and exact composite student relationships are retained", () => {
  assert.match(ledger, /CREATE UNIQUE INDEX "AttendanceRegister_schoolId_sessionId_classId_attendanceDate_key"/);
  assert.match(ledger, /CREATE UNIQUE INDEX "StudentEnrollment_attendance_identity"/);
  assert.match(ledger, /CREATE UNIQUE INDEX "AttendanceRegister_entry_identity"/);
  assert.match(ledger, /FOREIGN KEY \("schoolId", "enrollmentId", "studentId", "classId", "sessionId"\)/);
  assert.match(schema, /@@unique\(\[schoolId, sessionId, classId, attendanceDate\]\)/);
});

test("immutable attendance audit, correction history and one-way review remain required", () => {
  assert.match(ledger, /"AttendanceRegister_guard"/);
  assert.match(ledger, /"AttendanceEntry_immutable"/);
  assert.match(ledger, /"AttendanceEvent_immutable"/);
  assert.match(ledger, /"AttendanceRegister_require_events"/);
  assert.match(corrections, /"AttendanceCorrectionRequest_immutable"/);
  assert.match(corrections, /"AttendanceCorrectionDecision_immutable"/);
  assert.match(corrections, /"AttendanceCorrectionDecision_validate"/);
  assert.match(corrections, /"AttendanceCorrectionRequest_validate"/);
});

test("Prisma attendance audit relation maps match the migration FK names", () => {
  const attendanceEventModel = schema.match(/model AttendanceEvent \{[\s\S]*?\n\}/)?.[0];
  assert.ok(attendanceEventModel);
  assert.match(attendanceEventModel, /register\s+AttendanceRegister\s+@relation\([^\n]*map: "AttendanceEvent_schoolId_registerId_fkey"/);
  assert.match(attendanceEventModel, /actorMembership\s+Membership\s+@relation\([^\n]*map: "AttendanceEvent_actor_membership_fkey"/);
  assert.match(ledger, /ADD CONSTRAINT "AttendanceEvent_schoolId_registerId_fkey"/);
  assert.match(ledger, /ADD CONSTRAINT "AttendanceEvent_actor_membership_fkey"/);
});

test("new hardening migration adds no destructive statement or original mark update", () => {
  assert.doesNotMatch(hardening, /\b(?:DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+"AttendanceEntry"|ALTER\s+TABLE)\b/i);
  assert.match(hardening, /CREATE FUNCTION "validate_attendance_complete_roster"/);
});
