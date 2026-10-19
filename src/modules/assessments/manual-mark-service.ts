import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentFailure,
  assessmentUserId,
  exactAssessmentTeacher,
} from "./question-service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => v.trim() === v);
const componentInput = z
  .object({
    assignmentId: id,
    termId: id,
    kind: z.enum(["QUIZ", "TEST", "EXAM"]),
    title: z.string().trim().min(5).max(180),
    maxPoints: z.number().int().min(1).max(100),
  })
  .strict();
const proposalInput = z
  .object({
    componentId: id,
    studentId: id,
    earnedPoints: z.number().int().min(0).max(100),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
function checkSchool(value: string) {
  if (!id.safeParse(value).success) throw new AssessmentError("INVALID_INPUT");
}

/** Teacher creates an immutable offline/written component; it is not itself
 * an exam launch, class-sheet grade or approved result. */
export async function createManualAssessmentComponent(
  schoolId: string,
  input: unknown,
) {
  checkSchool(schoolId);
  const parsed = componentInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const owner = await exactAssessmentTeacher(
          tx,
          schoolId,
          userId,
          parsed.data.assignmentId,
          parsed.data.termId,
        );
        return tx.assessmentManualComponent.create({
          data: {
            id: randomUUID(),
            schoolId,
            sessionId: owner.term.sessionId,
            termId: owner.term.id,
            classId: owner.assignment.classId,
            subjectId: owner.assignment.subjectId,
            assignmentId: owner.assignment.id,
            teacherMembershipId: owner.teacherId,
            teacherUserId: userId,
            kind: parsed.data.kind,
            title: parsed.data.title,
            maxPoints: parsed.data.maxPoints,
          },
          select: {
            id: true,
            termId: true,
            classId: true,
            subjectId: true,
            sessionId: true,
            kind: true,
            title: true,
            maxPoints: true,
            createdAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    assessmentFailure(error);
  }
}

/** One initial, strictly nonofficial mark proposal per enrolled child and
 * component. SQL repeats teacher/student identity and max mark constraints.
 * No overwrite, second proposal, teacher self-approval or unofficial grades
 * are included in term sheets. A reviewed correction workflow is separate. */
export async function proposeManualAssessmentMark(
  schoolId: string,
  input: unknown,
) {
  checkSchool(schoolId);
  const parsed = proposalInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
        const component = await tx.assessmentManualComponent.findFirst({
          where: {
            id: parsed.data.componentId,
            schoolId,
            teacherUserId: userId,
            teacher: { userId, role: "TEACHER", isActive: true },
            assignment: {
              status: "ACTIVE",
              membership: { userId, role: "TEACHER", isActive: true },
            },
            session: { status: "ACTIVE" },
            term: { status: "ACTIVE" },
            schoolClass: { isActive: true, section: { isActive: true } },
            subject: { isActive: true },
            school: { isActive: true },
          },
          select: {
            id: true,
            classId: true,
            sessionId: true,
            maxPoints: true,
            teacherMembershipId: true,
          },
        });
        if (!component || parsed.data.earnedPoints > component.maxPoints) {
          throw new AssessmentError("NOT_FOUND");
        }
        const enrollments = await tx.studentEnrollment.findMany({
          where: {
            schoolId,
            studentId: parsed.data.studentId,
            classId: component.classId,
            sessionId: component.sessionId,
            status: "ACTIVE",
            student: { status: "ENROLLED" },
          },
          select: { id: true },
          take: 2,
        });
        if (enrollments.length !== 1) throw new AssessmentError("NOT_FOUND");
        return tx.assessmentManualMarkProposal.create({
          data: {
            id: randomUUID(),
            schoolId,
            componentId: component.id,
            studentId: parsed.data.studentId,
            enrollmentId: enrollments[0].id,
            classId: component.classId,
            sessionId: component.sessionId,
            earnedPoints: parsed.data.earnedPoints,
            reason: parsed.data.reason,
            actorMembershipId: component.teacherMembershipId,
            actorUserId: userId,
          },
          select: {
            id: true,
            componentId: true,
            studentId: true,
            earnedPoints: true,
            reason: true,
            createdAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    assessmentFailure(error);
  }
}

/** Teacher-only component list; no pupil data or keys. */
export async function listOwnManualComponents(schoolId: string) {
  checkSchool(schoolId);
  const userId = await assessmentUserId();
  const member = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      role: "TEACHER",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!member) throw new AssessmentError("NOT_FOUND");
  return prisma.assessmentManualComponent.findMany({
    where: {
      schoolId,
      teacherMembershipId: member.id,
      teacherUserId: userId,
      assignment: { status: "ACTIVE" },
      session: { status: "ACTIVE" },
      term: { status: "ACTIVE" },
      schoolClass: { isActive: true, section: { isActive: true } },
      subject: { isActive: true },
    },
    select: {
      id: true,
      title: true,
      kind: true,
      termId: true,
      classId: true,
      sessionId: true,
      subjectId: true,
      maxPoints: true,
      createdAt: true,
    },
    take: 100,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

/** Child names only through final exact teacher/component/student SQL joins;
 * never list pupils outside the currently assigned class/session. */
export async function listOwnManualComponentStudents(
  schoolId: string,
  componentId: string,
) {
  checkSchool(schoolId);
  if (!id.safeParse(componentId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const pupils = await prisma.$queryRaw<
    Array<{
      studentId: string;
      admissionNumber: string;
      givenName: string;
      familyName: string;
      proposed: boolean;
    }>
  >(Prisma.sql`
    SELECT pupil."id" AS "studentId", pupil."admissionNumber",
      pupil."givenName", pupil."familyName",
      EXISTS (SELECT 1 FROM "AssessmentManualMarkProposal" mark
        WHERE mark."schoolId"=component."schoolId"
          AND mark."componentId"=component."id"
          AND mark."studentId"=pupil."id") AS "proposed"
    FROM "AssessmentManualComponent" component
    JOIN "School" school ON school."id"=component."schoolId"
      AND school."isActive"=true
    JOIN "Membership" teacher ON teacher."schoolId"=school."id"
      AND teacher."id"=component."teacherMembershipId"
      AND teacher."userId"=${userId}
      AND teacher."userId"=component."teacherUserId"
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=component."schoolId"
      AND assignment."id"=component."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=component."classId"
      AND assignment."subjectId"=component."subjectId"
      AND assignment."sessionId"=component."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" period ON period."schoolId"=school."id"
      AND period."id"=component."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=school."id"
      AND term."sessionId"=period."id"
      AND term."id"=component."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" room ON room."schoolId"=school."id"
      AND room."id"=component."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=school."id"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=school."id"
      AND subject."id"=component."subjectId" AND subject."isActive"=true
    JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=school."id"
      AND enrollment."classId"=component."classId"
      AND enrollment."sessionId"=component."sessionId"
      AND enrollment."status"='ACTIVE'
    JOIN "StudentRecord" pupil ON pupil."schoolId"=school."id"
      AND pupil."id"=enrollment."studentId" AND pupil."status"='ENROLLED'
    WHERE component."schoolId"=${schoolId} AND component."id"=${componentId}
    ORDER BY pupil."admissionNumber", pupil."id" LIMIT 501
  `);
  if (!pupils.length) {
    const own = await prisma.assessmentManualComponent.findFirst({
      where: {
        schoolId,
        id: componentId,
        teacherUserId: userId,
        teacher: { userId, role: "TEACHER", isActive: true },
        assignment: { status: "ACTIVE" },
        session: { status: "ACTIVE" },
        term: { status: "ACTIVE" },
        schoolClass: { isActive: true, section: { isActive: true } },
        subject: { isActive: true },
        school: { isActive: true },
      },
      select: { id: true },
    });
    if (!own) throw new AssessmentError("NOT_FOUND");
  }
  if (
    pupils.length > 500 ||
    new Set(pupils.map((p) => p.studentId)).size !== pupils.length
  ) {
    throw new AssessmentError("CONFLICT");
  }
  return pupils;
}
