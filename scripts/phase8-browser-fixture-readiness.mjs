import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalVerificationTarget } from "./verify-local.mjs";

/**
 * Read-only inventory. npm's demo seed creates school owners, NOT verified
 * pupil/guardian pairs, academic releases or receipt state.
 * Never print credentials, student names, grades or IDs in the evidence log.
 */
export function assertBrowserFixtureTarget(environment) {
  assertLocalVerificationTarget(environment);
  if (
    environment.PHASE8_REPORT_RELEASE_ENABLED !== "false" ||
    environment.PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED !== "false"
  ) {
    throw new Error("Fixture inventory requires both report gates OFF");
  }
  const schoolId = environment.PHASE8_BROWSER_SCHOOL_ID;
  if (
    !schoolId ||
    schoolId !== schoolId.trim() ||
    schoolId.length > 128 ||
    !/^[a-zA-Z0-9_-]+$/.test(schoolId)
  ) {
    throw new Error("Specify an exact disposable synthetic school ID");
  }
  const url = new URL(environment.TEST_DATABASE_URL);
  if (url.searchParams.get("schema") !== "public") {
    throw new Error("Fixture inventory requires test database schema=public");
  }
  return schoolId;
}

export function summarizeBrowserFixture({
  schoolActive,
  policy,
  release,
  linkedParentChildIds,
  linkedStudentChildIds,
}) {
  const parents = new Set(linkedParentChildIds);
  const students = new Set(linkedStudentChildIds);
  const sharedChildren = [...parents].filter((id) => students.has(id)).length;
  const mode = policy?.mode ?? "NONE";
  const currentRelease =
    Boolean(release) &&
    release.visibilityPolicyId === policy?.id &&
    release.studentCount > 0;
  const relationshipReady =
    mode === "STUDENT_ONLY"
      ? students.size > 0
      : mode === "GUARDIAN_ONLY"
        ? parents.size > 0
        : mode === "GUARDIAN_FIRST_ACK"
          ? sharedChildren > 0
          : false;
  return {
    activeSchool: Boolean(schoolActive),
    currentPolicy: mode,
    hasCurrentApprovedRelease: currentRelease,
    activeGuardianLinkedChildren: parents.size,
    activeStudentLinkedChildren: students.size,
    activeBothLinkedChildren: sharedChildren,
    browserFixtureReady:
      Boolean(schoolActive) && currentRelease && relationshipReady,
  };
}

export async function inspectBrowserFixture(prisma, schoolId) {
  const [school, policy, parents, students] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { isActive: true },
    }),
    prisma.reportVisibilityPolicyRevision.findFirst({
      where: { schoolId },
      orderBy: { version: "desc" },
      select: { id: true, mode: true },
    }),
    prisma.guardianStudentLink.findMany({
      where: {
        schoolId,
        revocation: null,
        guardian: { isActive: true, role: "PARENT" },
      },
      select: { studentId: true },
    }),
    prisma.studentAccountLink.findMany({
      where: {
        schoolId,
        revocation: null,
        studentMembership: { isActive: true, role: "STUDENT" },
      },
      select: { studentId: true },
    }),
  ]);
  const release = policy
    ? await prisma.reportRecipientRelease.findFirst({
        where: { schoolId, visibilityPolicyId: policy.id },
        orderBy: { releasedAt: "desc" },
        select: { visibilityPolicyId: true, studentCount: true },
      })
    : null;
  return summarizeBrowserFixture({
    schoolActive: school?.isActive,
    policy,
    release,
    linkedParentChildIds: parents.map((row) => row.studentId),
    linkedStudentChildIds: students.map((row) => row.studentId),
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let prisma;
  try {
    const schoolId = assertBrowserFixtureTarget(process.env);
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    const summary = await inspectBrowserFixture(prisma, schoolId);
    console.info(JSON.stringify(summary, null, 2));
    if (!summary.browserFixtureReady) {
      console.error(
        "Synthetic browser fixture is incomplete; do not claim authenticated browser acceptance",
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Fixture inspection denied",
    );
    process.exitCode = 1;
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}
