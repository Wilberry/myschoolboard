/** Phase 8 preflight, not a report card or publication/approval decision.
 * Reconciles two independently teacher-authorized source projections.
 * Never combines objective and manual percentages or assigns final grades. */
export type PreparationBlocker =
  | "NO_ASSESSMENT_SOURCE"
  | "OBJECTIVE_SCORING_PENDING"
  | "MANUAL_REVIEW_PENDING"
  | "MANUAL_CORRECTION_PENDING"
  | "GRADING_POLICY_NOT_ADOPTED";
export interface PreparedSourceStudent {
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
}
export interface ObjectivePreparationStudent extends PreparedSourceStudent {
  assessmentCount: number;
  unscoredCount: number;
}
export interface ManualPreparationStudent extends PreparedSourceStudent {
  componentCount: number;
  unapprovedCount: number;
  pendingCorrections: number;
  academicallyComplete: boolean;
}
export interface SourceReadinessStudent extends PreparedSourceStudent {
  objectiveAssessments: number;
  unscoredObjectiveAssessments: number;
  manualComponents: number;
  unapprovedManualComponents: number;
  pendingManualCorrections: number;
  blockers: PreparationBlocker[];
  status: "NEEDS_SOURCE_WORK" | "SOURCES_RECONCILED_NOT_APPROVED";
}
export interface SourceReadiness {
  status: "PRIVATE_PREPARATION_ONLY";
  gradingPolicyVersion: number | null;
  studentCount: number;
  blockedCount: number;
  students: SourceReadinessStudent[];
}
function nonnegative(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
function sameStudent(a: PreparedSourceStudent, b: PreparedSourceStudent) {
  return (
    a.studentId === b.studentId &&
    a.admissionNumber === b.admissionNumber &&
    a.givenName === b.givenName &&
    a.familyName === b.familyName
  );
}
function validateIdentity(value: PreparedSourceStudent) {
  return (
    typeof value.studentId === "string" &&
    value.studentId.length > 0 &&
    typeof value.admissionNumber === "string" &&
    typeof value.givenName === "string" &&
    typeof value.familyName === "string"
  );
}
/** Fail closed on an exact active roster mismatch or duplicate, rather than
 * joining different pupils on display names/admission number alone.
 * Every pupil remains PREPARATION ONLY even with all marks ready because a
 * DRAFT_PREVIEW_ONLY grading revision is not an adopted academic rule. */
export function reconcileResultPreparation(
  objectives: readonly ObjectivePreparationStudent[],
  manual: readonly ManualPreparationStudent[],
  gradingPolicyVersion: number | null,
): SourceReadiness {
  if (
    objectives.length > 500 ||
    manual.length > 500 ||
    (gradingPolicyVersion !== null &&
      (!Number.isSafeInteger(gradingPolicyVersion) || gradingPolicyVersion < 1))
  ) {
    throw new Error("Invalid result preparation breadth or revision");
  }
  const manualById = new Map<string, ManualPreparationStudent>();
  for (const record of manual) {
    if (
      !validateIdentity(record) ||
      !nonnegative(record.componentCount) ||
      !nonnegative(record.unapprovedCount) ||
      !nonnegative(record.pendingCorrections) ||
      record.unapprovedCount > record.componentCount ||
      manualById.has(record.studentId)
    ) {
      throw new Error("Invalid or ambiguous manual source roster");
    }
    manualById.set(record.studentId, record);
  }
  const seen = new Set<string>();
  const students: SourceReadinessStudent[] = [];
  for (const objective of objectives) {
    const counterpart = manualById.get(objective.studentId);
    if (
      !validateIdentity(objective) ||
      seen.has(objective.studentId) ||
      !counterpart ||
      !sameStudent(objective, counterpart) ||
      !nonnegative(objective.assessmentCount) ||
      !nonnegative(objective.unscoredCount) ||
      objective.unscoredCount > objective.assessmentCount
    ) {
      throw new Error("Result sources disagree on exact active pupil roster");
    }
    seen.add(objective.studentId);
    const blockers: PreparationBlocker[] = [];
    if (objective.assessmentCount + counterpart.componentCount === 0)
      blockers.push("NO_ASSESSMENT_SOURCE");
    if (objective.unscoredCount > 0) blockers.push("OBJECTIVE_SCORING_PENDING");
    if (
      counterpart.unapprovedCount > 0 ||
      (!counterpart.academicallyComplete &&
        counterpart.componentCount > 0 &&
        counterpart.pendingCorrections === 0)
    )
      blockers.push("MANUAL_REVIEW_PENDING");
    if (counterpart.pendingCorrections > 0)
      blockers.push("MANUAL_CORRECTION_PENDING");
    // Neither the existence of a draft revision nor complete source marks
    // can imply an adopted school policy or an official result.
    blockers.push("GRADING_POLICY_NOT_ADOPTED");
    students.push({
      studentId: objective.studentId,
      admissionNumber: objective.admissionNumber,
      givenName: objective.givenName,
      familyName: objective.familyName,
      objectiveAssessments: objective.assessmentCount,
      unscoredObjectiveAssessments: objective.unscoredCount,
      manualComponents: counterpart.componentCount,
      unapprovedManualComponents: counterpart.unapprovedCount,
      pendingManualCorrections: counterpart.pendingCorrections,
      blockers,
      status:
        blockers.length > 1
          ? "NEEDS_SOURCE_WORK"
          : "SOURCES_RECONCILED_NOT_APPROVED",
    });
  }
  if (seen.size !== manualById.size)
    throw new Error("Source rosters have different students");
  return {
    status: "PRIVATE_PREPARATION_ONLY",
    gradingPolicyVersion,
    studentCount: students.length,
    blockedCount: students.filter((s) => s.status === "NEEDS_SOURCE_WORK")
      .length,
    students,
  };
}
