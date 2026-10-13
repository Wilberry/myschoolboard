import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";
import type { OwnerGradePreview } from "./private-owner-grade-preview-service";

const identifier = z.string().min(1).max(128).refine((value) => value.trim() === value);
const inputSchema = z.object({
  sessionId: identifier,
  termId: identifier,
  classId: identifier,
  studentId: identifier,
  reason: z.string().trim().min(5).max(500),
}).strict();

// This limit is a private response and transaction safety bound, NOT
// school curriculum policy. It must never be interpreted as a pass threshold.
const maximumPrivatePreviewSubjects = 100;
export type OwnerPrivateTermPreview = {
  status: "PRIVATE_TERM_OWNER_PREVIEW_NOT_RELEASED";
  coverage: "ACTIVE_SESSION_ASSIGNMENTS_ONLY_NOT_OFFICIAL_COMPLETENESS";
  schoolName: string;
  student: OwnerGradePreview["student"];
  academic: Pick<OwnerGradePreview["academic"], "session" | "term" | "class">;
  subjectCount: number;
  auditedSubjectCount: number;
  subjects: Array<{
    subject: string;
    displayPercent: string;
    rawPercentBps: number;
    gradeCode: string;
    remark: string;
    assessmentWeights: OwnerGradePreview["assessmentWeights"];
    categoryPercentBps: OwnerGradePreview["categoryPercentBps"];
    evidenceRevision: number;
    gradeScaleVersion: number;
    aggregationRuleVersion: number;
  }>;
};

function mapFailure(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code))) {
      throw new AssessmentError("CONFLICT");
    }
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}

/** Private owner-only one-pupil, multi-subject TERM preview.
 * This is NOT a complete school curriculum certification, class ranking,
 * published result, student/guardian reader or report-card download.
 *
 * Every selected subject is rechecked and audited inside the EXISTING
 * PostgreSQL one-pupil preview function. One SERIALIZABLE transaction means
 * that missing/stale subjects or audit failures roll back ALL individual
 * per-subject preview audits; nothing partial is returned to the caller.
 */
export async function previewPrivateOwnerStudentTerm(
  schoolId: string,
  input: unknown,
): Promise<OwnerPrivateTermPreview> {
  if (!identifier.safeParse(schoolId).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const { sessionId, termId, classId, studentId, reason } = parsed.data;
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE
      `;
      const owner = await tx.membership.findFirst({
        where: {
          schoolId, userId, isActive: true,
          role: "SCHOOL_SUPER_ADMIN",
          school: { isActive: true },
        },
        select: { id: true },
      });
      if (!owner) throw new AssessmentError("NOT_FOUND");

      const [term, classroom, pupilEnrollment] = await Promise.all([
        tx.academicTerm.findFirst({
          where: { schoolId, sessionId, id: termId },
          select: { id: true },
        }),
        tx.schoolClass.findFirst({
          where: { schoolId, id: classId, isActive: true },
          select: { id: true },
        }),
        tx.studentEnrollment.findFirst({
          where: {
            schoolId, sessionId, classId, studentId,
            status: "ACTIVE",
            student: { status: "ENROLLED" },
          },
          select: { id: true },
        }),
      ]);
      if (!term || !classroom || !pupilEnrollment) {
        throw new AssessmentError("NOT_FOUND");
      }

      // Only exact-session ACTIVE assigned subjects form this PRIVATE
      // coverage scope. There is not yet an adopted report-card subject
      // curriculum; this cannot establish final completeness for release.
      const expected = await tx.$queryRaw<
        Array<{ subjectId: string; subjectName: string }>
      >`
        SELECT DISTINCT subject."id" AS "subjectId",
          subject."name" AS "subjectName"
        FROM "TeacherClassSubjectAssignment" assignment
        JOIN "Subject" subject
          ON subject."schoolId"=assignment."schoolId"
          AND subject."id"=assignment."subjectId"
          AND subject."isActive"=true
        WHERE assignment."schoolId"=${schoolId}
          AND assignment."sessionId"=${sessionId}
          AND assignment."classId"=${classId}
          AND assignment."status"='ACTIVE'
        ORDER BY "subjectName","subjectId"
        LIMIT 101
      `;
      if (
        expected.length === 0 ||
        expected.length > maximumPrivatePreviewSubjects
      ) {
        throw new AssessmentError("CONFLICT");
      }
      const compositions = await tx.privateOfficialReportComposition.findMany({
        where: {
          schoolId, sessionId, termId, classId,
          subjectId: { in: expected.map((item) => item.subjectId) },
          status: "INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED",
        },
        select: {
          id: true, subjectId: true, evidenceRevision: true,
        },
        orderBy: { evidenceRevision: "desc" },
      });

      const selected = expected.map((subject) => {
        const matching = compositions.filter(
          (composition) => composition.subjectId === subject.subjectId,
        );
        const newest = matching[0];
        if (
          !newest ||
          matching.some((other, index) =>
            index > 0 && other.evidenceRevision === newest.evidenceRevision)
        ) {
          // Missing or ambiguous newest evidence is not previewable.
          throw new AssessmentError("CONFLICT");
        }
        return { ...subject, compositionId: newest.id };
      });

      let schoolName = "";
      let student: OwnerGradePreview["student"] | null = null;
      let academic: OwnerPrivateTermPreview["academic"] | null = null;
      const subjects: OwnerPrivateTermPreview["subjects"] = [];
      for (const item of selected) {
        // This VOLATILE function itself records an immutable preview audit.
        // No independent or unaudited grade-read SQL is used here.
        const rows = await tx.$queryRaw<
          Array<{
            result: {
              preview: OwnerGradePreview;
              audit: { id: string; status: string };
            };
          }>
        >`
          SELECT "read_private_owner_one_pupil_grade_preview"(
            ${schoolId},${item.compositionId},${studentId},
            ${owner.id},${userId},${randomUUID()},${reason}
          ) AS "result"
        `;
        const result = rows[0]?.result;
        const grade = result?.preview;
        if (
          !grade ||
          grade.status !== "PRIVATE_OWNER_PREVIEW_NOT_RELEASED" ||
          result?.audit?.status !== "INTERNAL_OWNER_PREVIEW_NOT_RELEASED" ||
          grade.academic.subject !== item.subjectName
        ) {
          throw new AssessmentError("CONFLICT");
        }
        if (student) {
          if (
            student.admissionNumber !== grade.student.admissionNumber ||
            student.givenName !== grade.student.givenName ||
            student.familyName !== grade.student.familyName ||
            schoolName !== grade.schoolName ||
            academic?.session !== grade.academic.session ||
            academic?.term !== grade.academic.term ||
            academic?.class !== grade.academic.class
          ) {
            throw new AssessmentError("CONFLICT");
          }
        } else {
          student = grade.student;
          schoolName = grade.schoolName;
          academic = {
            session: grade.academic.session,
            term: grade.academic.term,
            class: grade.academic.class,
          };
        }
        subjects.push({
          subject: item.subjectName,
          displayPercent: grade.displayPercent,
          rawPercentBps: grade.rawPercentBps,
          gradeCode: grade.gradeCode,
          remark: grade.remark,
          assessmentWeights: grade.assessmentWeights,
          categoryPercentBps: grade.categoryPercentBps,
          evidenceRevision: grade.evidenceRevision,
          gradeScaleVersion: grade.gradeScaleVersion,
          aggregationRuleVersion: grade.aggregationRuleVersion,
        });
      }
      if (!student || !academic || subjects.length !== expected.length) {
        throw new AssessmentError("CONFLICT");
      }
      return {
        status: "PRIVATE_TERM_OWNER_PREVIEW_NOT_RELEASED",
        coverage: "ACTIVE_SESSION_ASSIGNMENTS_ONLY_NOT_OFFICIAL_COMPLETENESS",
        schoolName, student, academic,
        subjectCount: subjects.length,
        auditedSubjectCount: subjects.length,
        subjects,
      };
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 30000 });
  } catch (error) {
    mapFailure(error);
  }
}
