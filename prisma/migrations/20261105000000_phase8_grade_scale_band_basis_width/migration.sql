-- Phase 8 forward-only repair: accept DISPLAY_ROUNDED_BPS (19 characters).
-- Do not rewrite already-applied migration 20261013140000 or policy histories.
-- School ownership, grade-band validation and immutable triggers stay intact.
ALTER TABLE "ReportGradeScaleRevision"
  ALTER COLUMN "bandBasis" TYPE VARCHAR(32);
