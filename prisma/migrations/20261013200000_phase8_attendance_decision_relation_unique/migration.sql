-- PostgreSQL already ensures <=1 decision per (schoolId, requestId).
-- Prisma 6 additionally requires uniqueness on the exact 3 FK fields of
-- AttendanceCorrectionDecision.request (schoolId, requestId, registerId).
-- This index is additive and redundant from a logical uniqueness perspective,
-- but preserves the existing referentially exact decision FK and all history.
-- No data mutation, policy change, publication or destructive schema action.
CREATE UNIQUE INDEX "AttendanceCorrectionDecision_request_relation_unique"
  ON "AttendanceCorrectionDecision" ("schoolId", "requestId", "registerId");
