-- Additive primary/secondary section ownership foundation.
-- Existing SchoolClass rows keep sectionId=NULL. Do not infer or backfill.
CREATE TYPE "SchoolSectionStage" AS ENUM ('PRIMARY', 'SECONDARY');
ALTER TYPE "SchoolConfigurationEventType" ADD VALUE 'SECTION_CREATED';
ALTER TYPE "SchoolConfigurationEventType" ADD VALUE 'CLASS_SECTION_ASSIGNED';

CREATE TABLE "SchoolSection" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stage" "SchoolSectionStage" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolSection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolSection_schoolId_id_key"
ON "SchoolSection"("schoolId", "id");
CREATE UNIQUE INDEX "SchoolSection_schoolId_name_key"
ON "SchoolSection"("schoolId", "name");
CREATE INDEX "SchoolSection_schoolId_stage_isActive_idx"
ON "SchoolSection"("schoolId", "stage", "isActive");
ALTER TABLE "SchoolSection"
ADD CONSTRAINT "SchoolSection_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolClass" ADD COLUMN "sectionId" TEXT;
CREATE INDEX "SchoolClass_schoolId_sectionId_idx"
ON "SchoolClass"("schoolId", "sectionId");
ALTER TABLE "SchoolClass"
ADD CONSTRAINT "SchoolClass_schoolId_sectionId_fkey"
FOREIGN KEY ("schoolId", "sectionId")
REFERENCES "SchoolSection"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

-- A NULL section is deliberately unclassified, never an implicit primary or
-- secondary class. Approval/enrollment routes must reject unclassified classes.
