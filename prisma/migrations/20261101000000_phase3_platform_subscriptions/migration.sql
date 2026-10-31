-- Phase 3: additive, platform-only subscription catalog and historical periods.
-- No plan backfill, school lifecycle mutation, billing, live charge, quota gate,
-- automatic expiry, role expansion or tenant academic data exposure.
CREATE TYPE "PlatformPlanFeature" AS ENUM (
  'ATTENDANCE', 'LESSONS', 'ASSESSMENTS', 'CBT'
);

CREATE TABLE "PlatformPlanRevision" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "features" "PlatformPlanFeature"[] NOT NULL,
  "maxStudents" INTEGER,
  "maxStaff" INTEGER,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformPlanRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformPlanRevision_bounds" CHECK (
    char_length("code") BETWEEN 3 AND 36
    AND "code" ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*
    AND char_length(btrim("name")) BETWEEN 3 AND 100
    AND char_length(btrim("reason")) BETWEEN 5 AND 500
    AND "version" >= 1
    AND ("maxStudents" IS NULL OR "maxStudents" BETWEEN 1 AND 1000000)
    AND ("maxStaff" IS NULL OR "maxStaff" BETWEEN 1 AND 1000000)
    AND cardinality("features") BETWEEN 1 AND 4
  )
);
CREATE UNIQUE INDEX "PlatformPlanRevision_code_version_key"
  ON "PlatformPlanRevision"("code", "version");
CREATE INDEX "PlatformPlanRevision_code_createdAt_idx"
  ON "PlatformPlanRevision"("code", "createdAt");

CREATE TABLE "SchoolSubscriptionPeriod" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "planRevisionId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolSubscriptionPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolSubscriptionPeriod_window" CHECK (
    "startsAt" < "endsAt"
    AND "endsAt" <= "startsAt" + INTERVAL '5 years'
    AND char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "SchoolSubscriptionPeriod_schoolId_id_key"
  ON "SchoolSubscriptionPeriod"("schoolId", "id");
CREATE INDEX "SchoolSubscriptionPeriod_schoolId_startsAt_endsAt_idx"
  ON "SchoolSubscriptionPeriod"("schoolId", "startsAt", "endsAt");
CREATE INDEX "SchoolSubscriptionPeriod_planRevisionId_idx"
  ON "SchoolSubscriptionPeriod"("planRevisionId");

-- Phase 5 timetable migration already installs btree_gist. This exclusion
-- constraint is the final SQL integrity boundary, including multi-row
-- direct INSERT and concurrent transactions (not just service-level checks).
ALTER TABLE "SchoolSubscriptionPeriod"
  ADD CONSTRAINT "SchoolSubscriptionPeriod_no_overlap"
  EXCLUDE USING gist (
    "schoolId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  );

ALTER TABLE "SchoolSubscriptionPeriod"
  ADD CONSTRAINT "SchoolSubscriptionPeriod_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolSubscriptionPeriod"
  ADD CONSTRAINT "SchoolSubscriptionPeriod_planRevisionId_fkey"
    FOREIGN KEY ("planRevisionId") REFERENCES "PlatformPlanRevision"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- A direct SQL actor claim must still identify a CURRENT Platform Super Admin.
-- This is app/database role policy, not database-superuser impersonation defense.
CREATE FUNCTION "validate_platform_plan_revision"()
RETURNS trigger AS $$
DECLARE next_version INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "User"
    WHERE "id" = NEW."actorUserId" AND "platformRole" = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Current platform administrator required'
      USING ERRCODE = '23503';
  END IF;
  IF (
    SELECT count(DISTINCT feature) FROM unnest(NEW."features") AS feature
  ) <> cardinality(NEW."features") THEN
    RAISE EXCEPTION 'Plan features must not repeat'
      USING ERRCODE = '23514';
  END IF;

  -- Serializes revisions for one plan code even with different actors.
  PERFORM pg_advisory_xact_lock(7007, hashtext(NEW."code"));
  SELECT coalesce(max("version"), 0)::integer + 1 INTO next_version
  FROM "PlatformPlanRevision" WHERE "code" = NEW."code";
  NEW."version" := next_version;
  NEW."createdAt" := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PlatformPlanRevision_validate"
BEFORE INSERT ON "PlatformPlanRevision"
FOR EACH ROW EXECUTE FUNCTION "validate_platform_plan_revision"();

CREATE FUNCTION "validate_school_subscription_period"()
RETURNS trigger AS $$
BEGIN
  -- The school row lock serializes every period assignment for a tenant.
  -- PENDING schools may receive a future plan, but no subscription turns
  -- school access on or changes School.lifecycleStatus / isActive.
  PERFORM 1 FROM "School" school
    WHERE school."id" = NEW."schoolId"
    AND school."lifecycleStatus" IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED')
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Classified non-closed school required'
      USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "User"
    WHERE "id" = NEW."actorUserId" AND "platformRole" = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Current platform administrator required'
      USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "PlatformPlanRevision"
    WHERE "id" = NEW."planRevisionId"
  ) THEN
    RAISE EXCEPTION 'Existing immutable plan revision required'
      USING ERRCODE = '23503';
  END IF;

  -- Explicit half-open windows: adjacent periods are allowed, overlaps
  -- rejected even for concurrent requests, including different plans.
  IF EXISTS (
    SELECT 1 FROM "SchoolSubscriptionPeriod" period
    WHERE period."schoolId" = NEW."schoolId"
      AND period."startsAt" < NEW."endsAt"
      AND period."endsAt" > NEW."startsAt"
  ) THEN
    RAISE EXCEPTION 'School subscription windows must not overlap'
      USING ERRCODE = '23505';
  END IF;
  NEW."createdAt" := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SchoolSubscriptionPeriod_validate"
BEFORE INSERT ON "SchoolSubscriptionPeriod"
FOR EACH ROW EXECUTE FUNCTION "validate_school_subscription_period"();

CREATE FUNCTION "prevent_platform_subscription_change"()
RETURNS trigger AS $$
BEGIN
  -- Preserve the established test-only school cascade cleanup behavior;
  -- app-level UPDATE/DELETE to the audit ledger remains denied.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Platform subscriptions are append-only'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PlatformPlanRevision_immutable"
BEFORE UPDATE OR DELETE ON "PlatformPlanRevision"
FOR EACH ROW EXECUTE FUNCTION "prevent_platform_subscription_change"();

CREATE TRIGGER "SchoolSubscriptionPeriod_immutable"
BEFORE UPDATE OR DELETE ON "SchoolSubscriptionPeriod"
FOR EACH ROW EXECUTE FUNCTION "prevent_platform_subscription_change"();

CREATE FUNCTION "prevent_platform_subscription_truncate"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Platform subscriptions cannot be truncated'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PlatformPlanRevision_no_truncate"
BEFORE TRUNCATE ON "PlatformPlanRevision"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_platform_subscription_truncate"();

CREATE TRIGGER "SchoolSubscriptionPeriod_no_truncate"
BEFORE TRUNCATE ON "SchoolSubscriptionPeriod"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_platform_subscription_truncate"();

    AND char_length(btrim("name")) BETWEEN 3 AND 100
    AND char_length(btrim("reason")) BETWEEN 5 AND 500
    AND "version" >= 1
    AND ("maxStudents" IS NULL OR "maxStudents" BETWEEN 1 AND 1000000)
    AND ("maxStaff" IS NULL OR "maxStaff" BETWEEN 1 AND 1000000)
    AND cardinality("features") BETWEEN 1 AND 4
  )
);
CREATE UNIQUE INDEX "PlatformPlanRevision_code_version_key"
  ON "PlatformPlanRevision"("code", "version");
CREATE INDEX "PlatformPlanRevision_code_createdAt_idx"
  ON "PlatformPlanRevision"("code", "createdAt");

CREATE TABLE "SchoolSubscriptionPeriod" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "planRevisionId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolSubscriptionPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolSubscriptionPeriod_window" CHECK (
    "startsAt" < "endsAt"
    AND "endsAt" <= "startsAt" + INTERVAL '5 years'
    AND char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "SchoolSubscriptionPeriod_schoolId_id_key"
  ON "SchoolSubscriptionPeriod"("schoolId", "id");
CREATE INDEX "SchoolSubscriptionPeriod_schoolId_startsAt_endsAt_idx"
  ON "SchoolSubscriptionPeriod"("schoolId", "startsAt", "endsAt");
CREATE INDEX "SchoolSubscriptionPeriod_planRevisionId_idx"
  ON "SchoolSubscriptionPeriod"("planRevisionId");

-- Phase 5 timetable migration already installs btree_gist. This exclusion
-- constraint is the final SQL integrity boundary, including multi-row
-- direct INSERT and concurrent transactions (not just service-level checks).
ALTER TABLE "SchoolSubscriptionPeriod"
  ADD CONSTRAINT "SchoolSubscriptionPeriod_no_overlap"
  EXCLUDE USING gist (
    "schoolId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  );

ALTER TABLE "SchoolSubscriptionPeriod"
  ADD CONSTRAINT "SchoolSubscriptionPeriod_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolSubscriptionPeriod"
  ADD CONSTRAINT "SchoolSubscriptionPeriod_planRevisionId_fkey"
    FOREIGN KEY ("planRevisionId") REFERENCES "PlatformPlanRevision"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- A direct SQL actor claim must still identify a CURRENT Platform Super Admin.
-- This is app/database role policy, not database-superuser impersonation defense.
CREATE FUNCTION "validate_platform_plan_revision"()
RETURNS trigger AS $$
DECLARE next_version INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "User"
    WHERE "id" = NEW."actorUserId" AND "platformRole" = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Current platform administrator required'
      USING ERRCODE = '23503';
  END IF;
  IF (
    SELECT count(DISTINCT feature) FROM unnest(NEW."features") AS feature
  ) <> cardinality(NEW."features") THEN
    RAISE EXCEPTION 'Plan features must not repeat'
      USING ERRCODE = '23514';
  END IF;

  -- Serializes revisions for one plan code even with different actors.
  PERFORM pg_advisory_xact_lock(7007, hashtext(NEW."code"));
  SELECT coalesce(max("version"), 0)::integer + 1 INTO next_version
  FROM "PlatformPlanRevision" WHERE "code" = NEW."code";
  NEW."version" := next_version;
  NEW."createdAt" := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PlatformPlanRevision_validate"
BEFORE INSERT ON "PlatformPlanRevision"
FOR EACH ROW EXECUTE FUNCTION "validate_platform_plan_revision"();

CREATE FUNCTION "validate_school_subscription_period"()
RETURNS trigger AS $$
BEGIN
  -- The school row lock serializes every period assignment for a tenant.
  -- PENDING schools may receive a future plan, but no subscription turns
  -- school access on or changes School.lifecycleStatus / isActive.
  PERFORM 1 FROM "School" school
    WHERE school."id" = NEW."schoolId"
    AND school."lifecycleStatus" IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED')
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Classified non-closed school required'
      USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "User"
    WHERE "id" = NEW."actorUserId" AND "platformRole" = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Current platform administrator required'
      USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "PlatformPlanRevision"
    WHERE "id" = NEW."planRevisionId"
  ) THEN
    RAISE EXCEPTION 'Existing immutable plan revision required'
      USING ERRCODE = '23503';
  END IF;

  -- Explicit half-open windows: adjacent periods are allowed, overlaps
  -- rejected even for concurrent requests, including different plans.
  IF EXISTS (
    SELECT 1 FROM "SchoolSubscriptionPeriod" period
    WHERE period."schoolId" = NEW."schoolId"
      AND period."startsAt" < NEW."endsAt"
      AND period."endsAt" > NEW."startsAt"
  ) THEN
    RAISE EXCEPTION 'School subscription windows must not overlap'
      USING ERRCODE = '23505';
  END IF;
  NEW."createdAt" := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SchoolSubscriptionPeriod_validate"
BEFORE INSERT ON "SchoolSubscriptionPeriod"
FOR EACH ROW EXECUTE FUNCTION "validate_school_subscription_period"();

CREATE FUNCTION "prevent_platform_subscription_change"()
RETURNS trigger AS $$
BEGIN
  -- Preserve the established test-only school cascade cleanup behavior;
  -- app-level UPDATE/DELETE to the audit ledger remains denied.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Platform subscriptions are append-only'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PlatformPlanRevision_immutable"
BEFORE UPDATE OR DELETE ON "PlatformPlanRevision"
FOR EACH ROW EXECUTE FUNCTION "prevent_platform_subscription_change"();

CREATE TRIGGER "SchoolSubscriptionPeriod_immutable"
BEFORE UPDATE OR DELETE ON "SchoolSubscriptionPeriod"
FOR EACH ROW EXECUTE FUNCTION "prevent_platform_subscription_change"();

CREATE FUNCTION "prevent_platform_subscription_truncate"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Platform subscriptions cannot be truncated'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PlatformPlanRevision_no_truncate"
BEFORE TRUNCATE ON "PlatformPlanRevision"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_platform_subscription_truncate"();

CREATE TRIGGER "SchoolSubscriptionPeriod_no_truncate"
BEFORE TRUNCATE ON "SchoolSubscriptionPeriod"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_platform_subscription_truncate"();
