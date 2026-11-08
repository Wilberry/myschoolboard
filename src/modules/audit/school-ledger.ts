import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  NoticeError,
  noticeActor,
  validSchool,
} from "@/src/modules/communications/service";

// Registry entries are code-owned SQL identifiers, never caller table names.
export const schoolAuditSources = [
  "TeacherClassSubjectAssignmentEvent",
  "SchoolLifecycleEvent",
  "SchoolConfigurationEvent",
  "FormTeacherEvent",
  "TimetableEvent",
  "LessonNoteEvent",
  "LessonReleaseEvent",
  "StudentEvent",
  "AttendanceEvent",
  "AssessmentReviewEvent",
  "AssessmentPublicationEvent",
  "ResultSheetReview",
  "ResultFinalPublicationDecision",
  "ReportPublication",
  "ReportPublicationWithdrawal",
  "ReportGuardianAcknowledgment",
  "PaymentVerificationDecision",
  "FeeAccountRelease",
  "FeeReceipt",
  "NoticeWorkflowEvent",
  "NoticeRelease",
  "NoticeWithdrawal",
  "ClassAnnouncementEvent",
  "LibraryCatalogReview",
  "LibraryCatalogRelease",
  "LibraryCatalogWithdrawal",
  "LearningAssetInspection",
  "LearningAssetRights",
  "LearningAssetRelease",
  "LearningAssetWithdrawal",
  "LearningAssignmentPolicy",
  "LearningAssignmentEvent",
  "LearningSubmissionReview",
] as const;
const sourceSchema = z.enum(schoolAuditSources);
const cursorSchema = z
  .object({
    source: sourceSchema,
    id: z.string().min(1).max(128),
    at: z.string().datetime({ precision: 6 }),
  })
  .strict();
interface Evidence {
  id: string;
  source: string;
  at: string;
  action: string;
  actorUserId: string | null;
}
export async function readSchoolAudit(
  schoolId: string,
  source?: string,
  cursor?: string,
) {
  if (process.env.PHASE10_AUDIT_ENABLED !== "true")
    throw new NoticeError("NOT_FOUND");
  validSchool(schoolId);
  const selected =
    source === undefined ? undefined : sourceSchema.safeParse(source);
  if (selected && !selected.success) throw new NoticeError("INVALID_INPUT");
  let position: z.infer<typeof cursorSchema> | undefined;
  if (cursor !== undefined) {
    if (!cursor || cursor.length > 800 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new NoticeError("INVALID_INPUT");
    try {
      position = cursorSchema.parse(
        JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
      );
    } catch {
      throw new NoticeError("INVALID_INPUT");
    }
    if (selected?.success && selected.data !== position.source)
      throw new NoticeError("INVALID_INPUT");
  }
  const actor = await noticeActor();
  const current = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >`SELECT phase10_owner(${schoolId},${actor}) AS allowed`;
  if (!current[0]?.allowed) throw new NoticeError("NOT_FOUND");
  const sources = selected?.success ? [selected.data] : schoolAuditSources;
  const sourceMetadata: Record<
    (typeof schoolAuditSources)[number],
    { timestamp: string; actor: string | null; action: string | null }
  > = {
    TeacherClassSubjectAssignmentEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "eventType",
    },
    SchoolLifecycleEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "eventType",
    },
    SchoolConfigurationEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "eventType",
    },
    FormTeacherEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "eventType",
    },
    TimetableEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "eventType",
    },
    LessonNoteEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "eventType",
    },
    LessonReleaseEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "eventType",
    },
    StudentEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "eventType",
    },
    AttendanceEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "eventType",
    },
    AssessmentReviewEvent: {
      timestamp: "createdAt",
      actor: "reviewerUserId",
      action: null,
    },
    AssessmentPublicationEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "action",
    },
    ResultSheetReview: {
      timestamp: "reviewedAt",
      actor: "reviewerUserId",
      action: "action",
    },
    ResultFinalPublicationDecision: {
      timestamp: "decidedAt",
      actor: "actorUserId",
      action: "status",
    },
    ReportPublication: {
      timestamp: "publishedAt",
      actor: "actorUserId",
      action: null,
    },
    ReportPublicationWithdrawal: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    ReportGuardianAcknowledgment: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    PaymentVerificationDecision: {
      timestamp: "decidedAt",
      actor: "reviewerUserId",
      action: "action",
    },
    FeeAccountRelease: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "action",
    },
    FeeReceipt: {
      timestamp: "issuedAt",
      actor: "actorUserId",
      action: null,
    },
    NoticeWorkflowEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "action",
    },
    NoticeRelease: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    NoticeWithdrawal: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    ClassAnnouncementEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "action",
    },
    LibraryCatalogReview: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "action",
    },
    LibraryCatalogRelease: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    LibraryCatalogWithdrawal: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    LearningAssetInspection: {
      timestamp: "createdAt",
      actor: null,
      action: "verdict",
    },
    LearningAssetRights: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    LearningAssetRelease: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    LearningAssetWithdrawal: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    LearningAssignmentPolicy: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: null,
    },
    LearningAssignmentEvent: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "action",
    },
    LearningSubmissionReview: {
      timestamp: "createdAt",
      actor: "actorUserId",
      action: "action",
    },
  };
  const parts = sources.map((name) => {
    const metadata = sourceMetadata[name];
    const timestamp = Prisma.raw('e."' + metadata.timestamp + '"');
    const actorReference = metadata.actor
      ? Prisma.raw('e."' + metadata.actor + '"::text')
      : Prisma.sql`NULL::text`;
    const action = metadata.action
      ? Prisma.raw('e."' + metadata.action + '"::text')
      : Prisma.sql`'RECORDED'::text`;
    return Prisma.sql`(SELECT e."id"::text AS id,${name}::text AS source,to_char(${timestamp} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,${action} AS action,${actorReference} AS "actorUserId",${timestamp} AS ordering FROM ${Prisma.raw('"' + name + '"')} e WHERE e."schoolId"=${schoolId} AND phase10_owner(${schoolId},${actor}) AND (${position?.at ?? null}::timestamptz IS NULL OR (${timestamp},${name}::text,e."id"::text)<(${position?.at ?? null}::timestamptz,${position?.source ?? null}::text,${position?.id ?? null}::text)) ORDER BY ${timestamp} DESC,e."id"::text DESC LIMIT 101)`;
  });
  const rows = await prisma.$queryRaw<Evidence[]>(
    Prisma.sql`SELECT id,source,at,action,"actorUserId" FROM (${Prisma.join(parts, " UNION ALL ")}) evidence ORDER BY ordering DESC,source DESC,id DESC LIMIT 101`,
  );
  const more = rows.length > 100;
  if (more) rows.pop();
  const last = rows.at(-1);
  return {
    events: rows,
    nextCursor:
      more && last
        ? Buffer.from(
            JSON.stringify({ source: last.source, id: last.id, at: last.at }),
          ).toString("base64url")
        : null,
  };
}
