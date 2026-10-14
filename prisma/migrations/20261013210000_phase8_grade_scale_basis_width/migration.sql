-- DISPLAY_ROUNDED_BPS is longer than 16 characters. Widen storage without
-- rewriting the already-applied grade-scale migration or changing existing rows.
ALTER TABLE "ReportGradeScaleRevision"
  ALTER COLUMN "bandBasis" TYPE VARCHAR(24);
