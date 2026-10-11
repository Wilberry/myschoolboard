-- CreateEnum
CREATE TYPE "TeacherClassSubjectAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherClassSubjectAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" "TeacherClassSubjectAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherClassSubjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_idx" ON "SchoolClass"("schoolId");
CREATE UNIQUE INDEX "SchoolClass_schoolId_id_key" ON "SchoolClass"("schoolId", "id");
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");
CREATE UNIQUE INDEX "Subject_schoolId_id_key" ON "Subject"("schoolId", "id");
CREATE INDEX "TeacherClassSubjectAssignment_schoolId_membershipId_status_idx" ON "TeacherClassSubjectAssignment"("schoolId", "membershipId", "status");
CREATE INDEX "TeacherClassSubjectAssignment_schoolId_classId_subjectId_st_idx" ON "TeacherClassSubjectAssignment"("schoolId", "classId", "subjectId", "status");
CREATE UNIQUE INDEX "TeacherClassSubjectAssignment_schoolId_membershipId_classId_key" ON "TeacherClassSubjectAssignment"("schoolId", "membershipId", "classId", "subjectId");
CREATE UNIQUE INDEX "Membership_schoolId_id_key" ON "Membership"("schoolId", "id");

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherClassSubjectAssignment" ADD CONSTRAINT "TeacherClassSubjectAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherClassSubjectAssignment" ADD CONSTRAINT "TeacherClassSubjectAssignment_schoolId_membershipId_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "Membership"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "TeacherClassSubjectAssignment" ADD CONSTRAINT "TeacherClassSubjectAssignment_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "SchoolClass"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "TeacherClassSubjectAssignment" ADD CONSTRAINT "TeacherClassSubjectAssignment_schoolId_subjectId_fkey" FOREIGN KEY ("schoolId", "subjectId") REFERENCES "Subject"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
