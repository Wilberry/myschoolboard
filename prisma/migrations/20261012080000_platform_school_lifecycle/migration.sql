-- Additive tenant lifecycle ledger. Legacy School.isActive values are preserved.
-- Existing schools intentionally have lifecycleStatus=NULL; do NOT infer a
-- historical reason for inactivity or backfill a guessed lifecycle.
CREATE TYPE "SchoolLifecycleStatus" AS ENUM (
  'PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CLOSED'
);
CREATE TYPE "SchoolLifecycleEventType" AS ENUM (
  'ONBOARDED', 'ACTIVATED', 'SUSPENDED', 'EXPIRED', 'CLOSED', 'REACTIVATED'
);

ALTER TABLE "School"
ADD COLUMN "lifecycleStatus" "SchoolLifecycleStatus";

CREATE TABLE "SchoolLifecycleEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "eventType" "SchoolLifecycleEventType" NOT NULL,
  "previousStatus" "SchoolLifecycleStatus",
  "newStatus" "SchoolLifecycleStatus" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchoolLifecycleEvent_schoolId_createdAt_idx"
ON "SchoolLifecycleEvent"("schoolId", "createdAt");
CREATE INDEX "SchoolLifecycleEvent_actorUserId_createdAt_idx"
ON "SchoolLifecycleEvent"("actorUserId", "createdAt");

ALTER TABLE "SchoolLifecycleEvent"
ADD CONSTRAINT "SchoolLifecycleEvent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Actor ids remain snapshots after role changes. Validate platform authority
-- at INSERT; privileged DB writers are still outside this app-level trust model.
CREATE FUNCTION "validate_school_lifecycle_actor"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "User"
    WHERE "id" = NEW."actorUserId" AND "platformRole" = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'School lifecycle audit actor must be a platform admin'
    USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SchoolLifecycleEvent_validate_actor"
BEFORE INSERT ON "SchoolLifecycleEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_school_lifecycle_actor"();

CREATE FUNCTION "prevent_school_lifecycle_event_mutation"() RETURNS trigger AS $$
BEGIN
  -- Allow existing explicit school cascade cleanup, not direct event deletion.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'School lifecycle events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SchoolLifecycleEvent_immutable"
BEFORE UPDATE OR DELETE ON "SchoolLifecycleEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_school_lifecycle_event_mutation"();

CREATE FUNCTION "prevent_school_lifecycle_event_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'School lifecycle events cannot be truncated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SchoolLifecycleEvent_no_truncate"
BEFORE TRUNCATE ON "SchoolLifecycleEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_school_lifecycle_event_truncate"();
