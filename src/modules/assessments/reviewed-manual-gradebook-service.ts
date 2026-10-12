import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "./question-service";

const valid = (v: string) => Boolean(v && v.length <= 128 && v.trim() === v);
type ReviewAction = "APPROVED" | "RETURNED" | null;
type Row = {
 studentId: string; admissionNumber: string; givenName: string; familyName: string;
 componentId: string | null; title: string | null; kind: "QUIZ"|"TEST"|"EXAM"|null;
 maxPoints: number | null; originalPoints: number | null;
 initialAction: ReviewAction; approvedPoints: number | null;
 approvedCorrectionRevision: number | null; latestCorrectionRevision: number | null;
 latestCorrectionAction: ReviewAction;
};
export type ReviewedManualComponentStatus =
 | "PENDING_TEACHER_MARK" | "PENDING_ACADEMIC_REVIEW" | "RETURNED_NOT_APPROVED"
 | "APPROVED_INITIAL" | "APPROVED_CORRECTED"
 | "APPROVED_CORRECTION_PENDING" | "APPROVED_CORRECTION_RETURNED"
 | "RETURNED_CORRECTION_PENDING";
export interface ReviewedManualComponent {
 componentId: string; title: string; kind: "QUIZ"|"TEST"|"EXAM";
 maxPoints: number; originalPoints: number | null;
 effectiveApprovedPoints: number | null;
 approvedCorrectionRevision: number | null;
 latestCorrectionRevision: number | null;
 status: ReviewedManualComponentStatus;
}
export interface ReviewedManualStudent {
 studentId: string; admissionNumber: string; givenName: string; familyName: string;
 components: ReviewedManualComponent[];
 approvedMarksSum: number; totalPossiblePoints: number;
 unapprovedComponents: number; pendingCorrections: number;
 completedPercentBps: number | null;
 readyForFurtherAcademicReview: boolean;
}
function status(row: Row): ReviewedManualComponentStatus {
 if (row.originalPoints === null) return "PENDING_TEACHER_MARK";
 if (row.initialAction === null) return "PENDING_ACADEMIC_REVIEW";
 if (row.initialAction === "RETURNED" && row.approvedCorrectionRevision === null) {
   if (row.latestCorrectionRevision !== null &&
       row.latestCorrectionAction === null) return "RETURNED_CORRECTION_PENDING";
   return "RETURNED_NOT_APPROVED";
 }
 if (row.latestCorrectionRevision !== null &&
     row.latestCorrectionAction === null) return "APPROVED_CORRECTION_PENDING";
 if (row.latestCorrectionRevision !== null &&
     row.latestCorrectionAction === "RETURNED") return "APPROVED_CORRECTION_RETURNED";
 if (row.approvedCorrectionRevision !== null) return "APPROVED_CORRECTED";
 return "APPROVED_INITIAL";
}
/** ONLY an internal teacher academic-preview gradebook. This is neither
 * final result publication nor merging unapproved written marks with CBT.
 * The last SELECT itself authenticates exact ACTIVE teacher assignment,
 * term/section, current enrolled children and independent academic decisions.
 * No answer key or student CBT answer is used or returned. */
export async function readInternalReviewedManualGradebook(
 schoolId:string,sessionId:string,termId:string,classId:string,subjectId:string,
):Promise<{schoolId:string;sessionId:string;termId:string;classId:string;
 subjectId:string;status:"ACADEMIC_APPROVED_PREVIEW_ONLY";
 students:ReviewedManualStudent[]}> {
 if (![schoolId,sessionId,termId,classId,subjectId].every(valid))
  throw new AssessmentError("INVALID_INPUT");
 const userId=await assessmentUserId();
 const accessible=await prisma.$queryRaw<Array<{id:string}>>(Prisma.sql`
  SELECT teacher."id" FROM "School" school
  JOIN "Membership" teacher ON teacher."schoolId"=school."id"
   AND teacher."userId"=${userId}
   AND teacher."role"='TEACHER' AND teacher."isActive"=true
  JOIN "TeacherClassSubjectAssignment" assignment
   ON assignment."schoolId"=school."id"
   AND assignment."membershipId"=teacher."id"
   AND assignment."classId"=${classId} AND assignment."subjectId"=${subjectId}
   AND assignment."sessionId"=${sessionId}
   AND assignment."status"='ACTIVE'
  JOIN "AcademicSession" period ON period."schoolId"=school."id"
   AND period."id"=assignment."sessionId" AND period."status"='ACTIVE'
  JOIN "AcademicTerm" term ON term."schoolId"=school."id"
   AND term."sessionId"=period."id"
   AND term."id"=${termId} AND term."status"='ACTIVE'
  JOIN "SchoolClass" room ON room."schoolId"=school."id"
   AND room."id"=assignment."classId" AND room."isActive"=true
  JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
   AND section."id"=room."sectionId" AND section."isActive"=true
  JOIN "Subject" subject ON subject."schoolId"=school."id"
   AND subject."id"=assignment."subjectId" AND subject."isActive"=true
  WHERE school."id"=${schoolId} AND school."isActive"=true LIMIT 1
 `);
 if(!accessible.length)throw new AssessmentError("NOT_FOUND");
 const rows=await prisma.$queryRaw<Row[]>(Prisma.sql`
  SELECT pupil."id" AS "studentId",pupil."admissionNumber",
   pupil."givenName",pupil."familyName",
   component."id" AS "componentId",component."title",component."kind",
   component."maxPoints",mark."earnedPoints" AS "originalPoints",
   initial."action" AS "initialAction",
   CASE WHEN corrected."proposedPoints" IS NOT NULL
     THEN corrected."proposedPoints"
     WHEN initial."action"='APPROVED' THEN mark."earnedPoints"
     ELSE NULL END AS "approvedPoints",
   corrected."revision" AS "approvedCorrectionRevision",
   latest."revision" AS "latestCorrectionRevision",
   latest."action" AS "latestCorrectionAction"
  FROM "School" school
  JOIN "Membership" teacher ON teacher."schoolId"=school."id"
   AND teacher."userId"=${userId}
   AND teacher."role"='TEACHER' AND teacher."isActive"=true
  JOIN "TeacherClassSubjectAssignment" assignment
   ON assignment."schoolId"=school."id"
   AND assignment."membershipId"=teacher."id"
   AND assignment."classId"=${classId}
   AND assignment."subjectId"=${subjectId}
   AND assignment."sessionId"=${sessionId}
   AND assignment."status"='ACTIVE'
  JOIN "AcademicSession" period ON period."schoolId"=school."id"
   AND period."id"=assignment."sessionId" AND period."status"='ACTIVE'
  JOIN "AcademicTerm" term ON term."schoolId"=school."id"
   AND term."sessionId"=period."id"
   AND term."id"=${termId} AND term."status"='ACTIVE'
  JOIN "SchoolClass" room ON room."schoolId"=school."id"
   AND room."id"=assignment."classId" AND room."isActive"=true
  JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
   AND section."id"=room."sectionId" AND section."isActive"=true
  JOIN "Subject" subject ON subject."schoolId"=school."id"
   AND subject."id"=assignment."subjectId" AND subject."isActive"=true
  JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=school."id"
   AND enrollment."classId"=room."id"
   AND enrollment."sessionId"=period."id"
   AND enrollment."status"='ACTIVE'
  JOIN "StudentRecord" pupil ON pupil."schoolId"=school."id"
   AND pupil."id"=enrollment."studentId" AND pupil."status"='ENROLLED'
  LEFT JOIN LATERAL (
   SELECT manual."id",manual."title",manual."kind",manual."maxPoints"
   FROM "AssessmentManualComponent" manual
   WHERE manual."schoolId"=school."id"
    AND manual."teacherMembershipId"=teacher."id"
    AND manual."teacherUserId"=${userId}
    AND manual."assignmentId"=assignment."id"
    AND manual."sessionId"=period."id"
    AND manual."termId"=term."id"
    AND manual."classId"=room."id"
    AND manual."subjectId"=subject."id"
   ORDER BY manual."createdAt",manual."id" LIMIT 31
  ) component ON true
  LEFT JOIN "AssessmentManualMarkProposal" mark
   ON mark."schoolId"=school."id"
   AND mark."componentId"=component."id"
   AND mark."studentId"=pupil."id"
   AND mark."enrollmentId"=enrollment."id"
   AND mark."classId"=room."id"
   AND mark."sessionId"=period."id"
  LEFT JOIN "AssessmentManualMarkDecision" initial
   ON initial."schoolId"=mark."schoolId"
   AND initial."proposalId"=mark."id"
  LEFT JOIN LATERAL (
   SELECT request."proposedPoints",request."revision"
   FROM "AssessmentManualCorrectionRequest" request
   JOIN "AssessmentManualCorrectionDecision" decision
    ON decision."schoolId"=request."schoolId"
    AND decision."requestId"=request."id"
    AND decision."action"='APPROVED'
   WHERE request."schoolId"=mark."schoolId"
    AND request."proposalId"=mark."id"
   ORDER BY request."revision" DESC LIMIT 1
  ) corrected ON true
  LEFT JOIN LATERAL (
   SELECT request."revision",decision."action"
   FROM "AssessmentManualCorrectionRequest" request
   LEFT JOIN "AssessmentManualCorrectionDecision" decision
    ON decision."schoolId"=request."schoolId"
    AND decision."requestId"=request."id"
   WHERE request."schoolId"=mark."schoolId"
    AND request."proposalId"=mark."id"
   ORDER BY request."revision" DESC LIMIT 1
  ) latest ON true
  WHERE school."id"=${schoolId} AND school."isActive"=true
  ORDER BY pupil."admissionNumber",pupil."id",component."id"
  LIMIT 15501
 `);
 if(rows.length>15500)throw new AssessmentError("CONFLICT");
 const students=new Map<string,ReviewedManualStudent>();
 const seenEmptyRows=new Set<string>();
 for(const r of rows){
  if(r.componentId===null) {
   if(seenEmptyRows.has(r.studentId))throw new AssessmentError("CONFLICT");
   seenEmptyRows.add(r.studentId);
  }
  let student=students.get(r.studentId);
  if(!student){
   student={studentId:r.studentId,admissionNumber:r.admissionNumber,
    givenName:r.givenName,familyName:r.familyName,
    components:[],approvedMarksSum:0,totalPossiblePoints:0,
    unapprovedComponents:0,pendingCorrections:0,
    completedPercentBps:null,readyForFurtherAcademicReview:false};
   students.set(r.studentId,student);
  }
  if(r.componentId&&r.title&&r.kind){
   if(student.components.length>=30 ||
    student.components.some(c=>c.componentId===r.componentId))
    throw new AssessmentError("CONFLICT");
   const max=r.maxPoints??0;
   if(max<1||max>100||r.approvedPoints!==null &&
      (r.approvedPoints<0||r.approvedPoints>max))throw new AssessmentError("CONFLICT");
   const currentStatus=status(r);
   const component:ReviewedManualComponent={
    componentId:r.componentId,title:r.title,kind:r.kind,maxPoints:max,
    originalPoints:r.originalPoints,effectiveApprovedPoints:r.approvedPoints,
    approvedCorrectionRevision:r.approvedCorrectionRevision,
    latestCorrectionRevision:r.latestCorrectionRevision,status:currentStatus,
   };
   student.components.push(component);
   student.totalPossiblePoints+=max;
   if(component.effectiveApprovedPoints===null)student.unapprovedComponents++;
   else student.approvedMarksSum+=component.effectiveApprovedPoints;
   if(currentStatus==="APPROVED_CORRECTION_PENDING" ||
      currentStatus==="RETURNED_CORRECTION_PENDING")student.pendingCorrections++;
  }
  if(students.size>500)throw new AssessmentError("CONFLICT");
 }
 for(const student of students.values()){
  student.readyForFurtherAcademicReview=student.components.length>0 &&
    student.unapprovedComponents===0&&student.pendingCorrections===0;
  student.completedPercentBps=student.readyForFurtherAcademicReview &&
    student.totalPossiblePoints>0
    ? Math.round(student.approvedMarksSum*10000/student.totalPossiblePoints):null;
 }
 return {schoolId,sessionId,termId,classId,subjectId,
  status:"ACADEMIC_APPROVED_PREVIEW_ONLY",students:Array.from(students.values())};
}
