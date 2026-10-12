import { prisma } from "@/src/lib/db";

export interface AssignmentReader {
  userId: string;
  schoolId: string;
  role: "SCHOOL_ADMIN" | "SCHOOL_SUPER_ADMIN";
}

const assignmentFields = {
  id: true,
  schoolId: true,
  membershipId: true,
  classId: true,
  subjectId: true,
  status: true,
  createdAt: true,
} as const;

function authorizedSchool(reader: AssignmentReader) {
  return {
    schoolId: reader.schoolId,
    school: {
      isActive: true,
      memberships: {
        some: {
          userId: reader.userId,
          isActive: true,
          role: reader.role,
        },
      },
    },
  };
}

export const assignmentPageSize = 50;

/**
 * A read always retains school ownership and the reader's current active
 * membership/role in the final SQL query. Cursor validation uses the same
 * predicate so a cursor from another school is not accepted.
 */
export async function listAdminAssignments(
  reader: AssignmentReader,
  cursor?: string,
) {
  const where = authorizedSchool(reader);
  if (cursor) {
    const accessibleCursor =
      await prisma.teacherClassSubjectAssignment.findFirst({
      where: { ...where, id: cursor },
      select: { id: true },
    });
    if (!accessibleCursor) return null;
  }

  const records = await prisma.teacherClassSubjectAssignment.findMany({
    where,
    select: assignmentFields,
    orderBy: { id: "asc" },
    take: assignmentPageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = records.length > assignmentPageSize;
  const assignments = records.slice(0, assignmentPageSize);
  return {
    assignments,
    nextCursor: hasMore ? assignments[assignments.length - 1].id : null,
  };
}

export async function getAdminAssignment(
  reader: AssignmentReader,
  assignmentId: string,
) {
  return prisma.teacherClassSubjectAssignment.findFirst({
    where: {
      ...authorizedSchool(reader),
      id: assignmentId,
    },
    select: assignmentFields,
  });
}
