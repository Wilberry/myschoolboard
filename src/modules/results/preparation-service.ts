import { AssessmentError } from "@/src/modules/assessments/question-service";
import { readInternalTeacherClassRecord } from "@/src/modules/assessments/class-record-service";
import { readInternalReviewedManualGradebook } from "@/src/modules/assessments/reviewed-manual-gradebook-service";
import { reconcileResultPreparation } from "./result-readiness";

/** Authoring-only Phase 8 inventory: two independently teacher-authorized,
 * school/class/subject/session/term-specific reads. Disagreements fail closed.
 * Never persists scores, certifies source freshness for official use,
 * combines grading systems or approves/publishes results.
 */
export async function readInternalTeacherResultPreparation(
  schoolId: string, sessionId: string, termId: string,
  classId: string, subjectId: string,
) {
  // Both readers independently repeat final-query active teacher assignment,
  // current enrolled pupil, same-school and academic period authorization.
  const objective = await readInternalTeacherClassRecord(
    schoolId, sessionId, termId, classId, subjectId,
  );
  const manual = await readInternalReviewedManualGradebook(
    schoolId, sessionId, termId, classId, subjectId,
  );
  if (manual.schoolId !== schoolId ||
      manual.classId !== objective.classId ||
      manual.sessionId !== objective.sessionId ||
      manual.termId !== objective.termId ||
      manual.subjectId !== objective.subjectId ||
      objective.classId !== classId ||
      objective.subjectId !== subjectId ||
      objective.sessionId !== sessionId ||
      objective.termId !== termId) {
    throw new AssessmentError("CONFLICT");
  }
  try {
    return reconcileResultPreparation(
      objective.students.map(s => ({
        studentId: s.studentId, admissionNumber: s.admissionNumber,
        givenName: s.givenName, familyName: s.familyName,
        assessmentCount: s.assessments.length,
        unscoredCount: s.pendingAssessments,
      })),
      manual.students.map(s => ({
        studentId: s.studentId, admissionNumber: s.admissionNumber,
        givenName: s.givenName, familyName: s.familyName,
        componentCount: s.components.length,
        unapprovedCount: s.unapprovedComponents,
        pendingCorrections: s.pendingCorrections,
        academicallyComplete: s.readyForFurtherAcademicReview,
      })),
      objective.gradingPolicy?.version ?? null,
    );
  } catch {
    // A revocation or competing enrollment change across independent source
    // reads must not leak a partial/mismatched roster or be treated as ready.
    throw new AssessmentError("CONFLICT");
  }
}
