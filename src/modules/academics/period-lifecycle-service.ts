import { z } from "zod";
import { mayTransitionPeriod } from "./period-policy";
import { prisma } from "@/src/lib/db";
import {
  AcademicConfigError,
  actorId,
  mapError,
  requireSchoolConfigActor,
} from "./config-service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => v === v.trim());
const transitionSchema = z
  .object({
    status: z.enum(["ACTIVE", "CLOSED"]),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export async function changeAcademicPeriod(
  schoolId: string,
  sessionId: string,
  termId: string | undefined,
  input: unknown,
) {
  if (
    !id.safeParse(schoolId).success ||
    !id.safeParse(sessionId).success ||
    (termId !== undefined && !id.safeParse(termId).success)
  ) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const data = transitionSchema.safeParse(input);
  if (!data.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "AcademicSession"
          WHERE "id" = ${sessionId} AND "schoolId" = ${schoolId} FOR UPDATE`;
        const session = await tx.academicSession.findFirst({
          where: { id: sessionId, schoolId },
          select: { id: true, status: true },
        });
        if (!session) throw new AcademicConfigError("NOT_FOUND");

        if (termId === undefined) {
          if (!mayTransitionPeriod(session.status, data.data.status)) {
            throw new AcademicConfigError("CONFLICT");
          }
          if (data.data.status === "CLOSED") {
            const unclosedTerms = await tx.academicTerm.count({
              where: {
                schoolId,
                sessionId,
                status: { not: "CLOSED" },
              },
            });
            if (unclosedTerms > 0) throw new AcademicConfigError("CONFLICT");
          }
          const changed = await tx.academicSession.update({
            where: { id: sessionId },
            data: { status: data.data.status },
            select: {
              id: true,
              schoolId: true,
              status: true,
              name: true,
            },
          });
          await tx.schoolConfigurationEvent.create({
            data: {
              schoolId,
              actorUserId: userId,
              actorMembershipId: actor.membershipId,
              resourceId: sessionId,
              reason: data.data.reason,
              eventType:
                data.data.status === "ACTIVE"
                  ? "ACADEMIC_SESSION_ACTIVATED"
                  : "ACADEMIC_SESSION_CLOSED",
            },
          });
          return { session: changed };
        }

        await tx.$queryRaw`SELECT "id" FROM "AcademicTerm"
          WHERE "id" = ${termId}
            AND "schoolId" = ${schoolId}
            AND "sessionId" = ${sessionId} FOR UPDATE`;
        const term = await tx.academicTerm.findFirst({
          where: { id: termId, schoolId, sessionId },
          select: { status: true },
        });
        if (!term) throw new AcademicConfigError("NOT_FOUND");
        if (!mayTransitionPeriod(term.status, data.data.status)) {
          throw new AcademicConfigError("CONFLICT");
        }
        if (session.status !== "ACTIVE") {
          throw new AcademicConfigError("CONFLICT");
        }
        const changed = await tx.academicTerm.update({
          where: { id: termId },
          data: { status: data.data.status },
          select: {
            id: true,
            schoolId: true,
            sessionId: true,
            status: true,
            name: true,
            position: true,
          },
        });
        await tx.schoolConfigurationEvent.create({
          data: {
            schoolId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            resourceId: termId,
            reason: data.data.reason,
            eventType:
              data.data.status === "ACTIVE"
                ? "ACADEMIC_TERM_ACTIVATED"
                : "ACADEMIC_TERM_CLOSED",
          },
        });
        return { term: changed };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}
