import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";

const id = z.string().min(1).max(128).refine((value) => value.trim() === value);
const scopeSchema = z.object({
  sessionId: id,
  termId: id,
  classId: id,
}).strict();

export type PrivateSubjectCoverageState =
  | "MISSING_TEACHER_RESULT_EVIDENCE"
  | "AWAITING_ACADEMIC_REVIEW"
  | "AWAITING_OWNER_DECISION"
  | "AWAITING_PRIVATE_COMPOSITION"
  | "PRIVATE_COMPOSITION_POLICY_SUPERSEDED"
  | "PRIVATE_COMPOSITION_METADATA_PRESENT_NOT_RELEASED";

export type PrivateSubjectCoverage = {
  subjectId: string;
  subjectName: string;
  state: PrivateSubjectCoverageState;
  evidenceRevision: number | null;
  pupilCount: number | null;
};

/** Diagnostic of only configured ACTIVE session teacher assignments.
 * A 'metadata present' row is NOT proof that current teacher/reviewer
 * authorizations, roster or frozen grades remain valid. Neither this
 * diagnostic nor its count can authorize publication or grade access.
 */
export async function inspectPrivateClassTermSubjectCoverage(
  schoolId: string,
  scope: unknown,
): Promise<{
  status: "PRIVATE_SUBJECT_COVERAGE_METADATA_NOT_PUBLICATION";
  sessionId: string;
  termId: string;
  classId: string;
  configuredSubjectCount: number;
  subjects: PrivateSubjectCoverage[];
}> {
  if (!id.safeParse(schoolId).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const parsed = scopeSchema.safeParse(scope);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const { sessionId, termId, classId } = parsed.data;
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async (tx) => {
    // Serializes the scope snapshot with school lifecycle and policy changes.
    const schools = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "School"
      WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
    if (!schools.length) throw new AssessmentError("NOT_FOUND");
    const owner = await tx.membership.findFirst({
      where: {
        schoolId, userId,
        role: "SCHOOL_SUPER_ADMIN", isActive: true,
        school: { isActive: true },
      },
      select: { id: true },
    });
    if (!owner) throw new AssessmentError("NOT_FOUND");
    const [cls, session, term] = await Promise.all([
      tx.schoolClass.findFirst({
        where: { schoolId, id: classId, isActive: true },
        select: { id: true },
      }),
      tx.academicSession.findFirst({
        where: { schoolId, id: sessionId },
        select: { id: true },
      }),
      tx.academicTerm.findFirst({
        where: { schoolId, id: termId, sessionId },
        select: { id: true },
      }),
    ]);
    if (!cls || !session || !term) throw new AssessmentError("NOT_FOUND");

    // Only explicit class/session active teaching assignments define this
    // *diagnostic* scope. A NULL-session assignment is not silently mapped
    // into an exact academic period. A separate school-adopted subject
    // curriculum inventory remains necessary for official completeness.
    const assigned = await tx.teacherClassSubjectAssignment.findMany({
      where: {
        schoolId, classId, sessionId, status: "ACTIVE",
        membership: { isActive: true },
        subject: { isActive: true },
      },
      select: {
        subjectId: true,
        subject: { select: { name: true } },
      },
      take: 501,
    });
    if (assigned.length > 500) throw new AssessmentError("CONFLICT");
    const subjects = [...new Map(
      assigned.map((entry) => [entry.subjectId, entry.subject.name]),
    )].map(([subjectId, subjectName]) => ({ subjectId, subjectName }));
    if (subjects.length === 0) {
      return {
        status: "PRIVATE_SUBJECT_COVERAGE_METADATA_NOT_PUBLICATION" as const,
        sessionId, termId, classId,
        configuredSubjectCount: 0, subjects: [],
      };
    }
    const subjectIds = subjects.map((subject) => subject.subjectId);
    const [evidences, gradeScale, aggregationRule] = await Promise.all([
      tx.resultSheetEvidence.findMany({
        where: { schoolId, sessionId, termId, classId, subjectId: { in: subjectIds } },
        select: {
          id: true, subjectId: true, revision: true, studentCount: true,
        },
        orderBy: [{ revision: "desc" }, { preparedAt: "desc" }],
        take: 501,
      }),
      tx.reportGradeScaleRevision.findFirst({
        where: { schoolId }, select: { id: true, version: true },
        orderBy: { version: "desc" },
      }),
      tx.reportAggregationRuleRevision.findFirst({
        where: { schoolId }, select: { id: true, version: true },
        orderBy: { version: "desc" },
      }),
    ]);
    // Never misrepresent incomplete evidence history as current.
    if (evidences.length > 500) throw new AssessmentError("CONFLICT");
    const latestEvidence = new Map<string, (typeof evidences)[number]>();
    for (const evidence of evidences) {
      if (!latestEvidence.has(evidence.subjectId)) {
        latestEvidence.set(evidence.subjectId, evidence);
      }
    }
    const evidenceIds = [...latestEvidence.values()].map((evidence) => evidence.id);
    const [reviews, decisions, compositions] = await Promise.all([
      tx.resultSheetReview.findMany({
        where: { schoolId, evidenceId: { in: evidenceIds } },
        select: { evidenceId: true, action: true },
      }),
      tx.resultFinalPublicationDecision.findMany({
        where: { schoolId, evidenceId: { in: evidenceIds } },
        select: { id: true, evidenceId: true, status: true },
      }),
      tx.privateOfficialReportComposition.findMany({
        where: { schoolId, evidenceId: { in: evidenceIds } },
        select: {
          evidenceId: true, finalDecisionId: true, status: true,
          gradeScaleId: true, gradeScaleVersion: true,
          aggregationRuleId: true, aggregationRuleVersion: true,
        },
      }),
    ]);
    const approved = new Set(reviews.filter((review) => review.action === "APPROVED")
      .map((review) => review.evidenceId));
    const ownerDecisions = new Map(decisions
      .filter((decision) => decision.status === "APPROVED_AWAITING_RELEASE")
      .map((decision) => [decision.evidenceId, decision.id]));
    const privateCompositions = new Map(compositions
      .filter((composition) => composition.status === "INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED")
      .map((composition) => [composition.evidenceId, composition]));

    const coverage = subjects.map(({ subjectId, subjectName }) => {
      const evidence = latestEvidence.get(subjectId);
      let state: PrivateSubjectCoverageState;
      if (!evidence) state = "MISSING_TEACHER_RESULT_EVIDENCE";
      else if (!approved.has(evidence.id)) state = "AWAITING_ACADEMIC_REVIEW";
      else if (!ownerDecisions.has(evidence.id)) state = "AWAITING_OWNER_DECISION";
      else {
        const composition = privateCompositions.get(evidence.id);
        if (!composition || composition.finalDecisionId !== ownerDecisions.get(evidence.id)) {
          state = "AWAITING_PRIVATE_COMPOSITION";
        } else if (
          !gradeScale || !aggregationRule ||
          composition.gradeScaleId !== gradeScale.id ||
          composition.gradeScaleVersion !== gradeScale.version ||
          composition.aggregationRuleId !== aggregationRule.id ||
          composition.aggregationRuleVersion !== aggregationRule.version
        ) {
          state = "PRIVATE_COMPOSITION_POLICY_SUPERSEDED";
        } else {
          state = "PRIVATE_COMPOSITION_METADATA_PRESENT_NOT_RELEASED";
        }
      }
      return {
        subjectId, subjectName, state,
        evidenceRevision: evidence?.revision ?? null,
        pupilCount: evidence?.studentCount ?? null,
      };
    }).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName) || a.subjectId.localeCompare(b.subjectId));
    return {
      status: "PRIVATE_SUBJECT_COVERAGE_METADATA_NOT_PUBLICATION" as const,
      sessionId, termId, classId,
      configuredSubjectCount: coverage.length,
      subjects: coverage,
    };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof AssessmentError) throw error;
    if (error && typeof error === "object" && "code" in error) {
      if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code))) {
        throw new AssessmentError("CONFLICT");
      }
      if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
    }
    throw new AssessmentError("INTERNAL");
  }
}
