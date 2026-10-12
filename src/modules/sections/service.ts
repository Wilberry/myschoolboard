import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AcademicConfigError,
  actorId,
  mapError,
  requireSchoolConfigActor,
} from "@/src/modules/academics/config-service";

const identifier = z.string().trim().min(1).max(128);
const reason = z.string().trim().min(5).max(500);
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  stage: z.enum(["PRIMARY", "SECONDARY"]),
  reason,
}).strict();
const assignSchema = z.object({
  sectionId: identifier,
  reason,
}).strict();

/**
 * Only existing school administrators can classify primary/secondary sections.
 * Names are school-owned and never infer academic levels of existing classes.
 */
export async function createSchoolSection(schoolId: string, input: unknown) {
  if (!identifier.safeParse(schoolId).success) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        const section = await tx.schoolSection.create({
          data: {
            schoolId,
            name: parsed.data.name,
            stage: parsed.data.stage,
          },
          select: {
            id: true,
            schoolId: true,
            name: true,
            stage: true,
            isActive: true,
          },
        });
        await tx.schoolConfigurationEvent.create({
          data: {
            schoolId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "SECTION_CREATED",
            resourceId: section.id,
            reason: parsed.data.reason,
          },
        });
        return section;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

/**
 * A class can be classified once. Future reassignment of an established
 * class/grade cohort is a separate reviewed history-preserving workflow.
 */
export async function assignClassToSection(
  schoolId: string,
  classId: string,
  input: unknown,
) {
  if (
    !identifier.safeParse(schoolId).success ||
    !identifier.safeParse(classId).success
  ) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "SchoolSection"
          WHERE "id" = ${parsed.data.sectionId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "SchoolClass"
          WHERE "id" = ${classId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;

        const [section, schoolClass] = await Promise.all([
          tx.schoolSection.findFirst({
            where: { id: parsed.data.sectionId, schoolId, isActive: true },
            select: { id: true },
          }),
          tx.schoolClass.findFirst({
            where: { id: classId, schoolId, isActive: true },
            select: { id: true, sectionId: true },
          }),
        ]);
        if (!section || !schoolClass) throw new AcademicConfigError("NOT_FOUND");
        if (schoolClass.sectionId) throw new AcademicConfigError("CONFLICT");

        const changed = await tx.schoolClass.update({
          where: { id: classId },
          data: { sectionId: section.id },
          select: {
            id: true,
            schoolId: true,
            name: true,
            sectionId: true,
            isActive: true,
          },
        });
        await tx.schoolConfigurationEvent.create({
          data: {
            schoolId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "CLASS_SECTION_ASSIGNED",
            resourceId: classId,
            reason: parsed.data.reason,
          },
        });
        return changed;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}
