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
  targetChildId = null,
  targetChildInCurrentRelease = null,
}) {
  const parents = new Set(linkedParentChildIds);
  const students = new Set(linkedStudentChildIds);
  const sharedChildren = [...parents].filter((id) => students.has(id)).length;
  const mode = policy?.mode ?? "NONE";
  const currentRelease =
    Boolean(release) &&
    release.visibilityPolicyId === policy?.id &&
    release.studentCount > 0;
  // When accepting a particular browser account, a link to SOME other
  // child is not evidence that this exact synthetic pupil is testable.
  const hasParent = targetChildId
    ? parents.has(targetChildId)
    : parents.size > 0;
  const hasStudent = targetChildId
    ? students.has(targetChildId)
    : students.size > 0;
  const relationshipReady =
    mode === "STUDENT_ONLY"
      ? hasStudent
      : mode === "GUARDIAN_ONLY"
        ? hasParent
        : mode === "GUARDIAN_FIRST_ACK"
          ? targetChildId
            ? hasParent && hasStudent
            : sharedChildren > 0
          : false;
  return {
    activeSchool: Boolean(schoolActive),
    currentPolicy: mode,
    hasCurrentApprovedRelease: currentRelease,
    activeGuardianLinkedChildren: parents.size,
    activeStudentLinkedChildren: students.size,
    activeBothLinkedChildren: sharedChildren,
    targetChildInCurrentRelease: targetChildId
      ? targetChildInCurrentRelease === true
      : null,
    browserFixtureReady:
      Boolean(schoolActive) &&
      currentRelease &&
      relationshipReady &&
      (!targetChildId || targetChildInCurrentRelease === true),
  };
}

export async function inspectBrowserFixture(
  prisma,
  schoolId,
  targetChildId = null,
) {
  if (
    targetChildId !== null &&
    (typeof targetChildId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(targetChildId))
  ) {
    throw new Error("Invalid synthetic fixture child ID");
  }
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
  // Only return a boolean. A link to the selected child is not proof that
  // this child occurs in any current, non-superseded frozen recipient release.
  // Do not fetch composed grade JSON into the inventory process or print IDs.
  const targetReleaseEvidence =
    targetChildId && policy && release
      ? await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT 1
            FROM "ReportRecipientRelease" currentRelease
            JOIN "PrivateOfficialReportComposition" composition
              ON composition."schoolId" = currentRelease."schoolId"
              AND composition."id" = currentRelease."compositionId"
              AND composition."status" = 'INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED'
            JOIN "StudentRecord" pupil
              ON pupil."schoolId" = currentRelease."schoolId"
              AND pupil."id" = ${targetChildId}
              AND pupil."status" = 'ENROLLED'
            JOIN "StudentEnrollment" enrollment
              ON enrollment."schoolId" = currentRelease."schoolId"
              AND enrollment."studentId" = pupil."id"
              AND enrollment."sessionId" = currentRelease."sessionId"
              AND enrollment."classId" = currentRelease."classId"
              AND enrollment."status" = 'ACTIVE'
            CROSS JOIN LATERAL jsonb_array_elements(
              composition."composedStudentCards"
            ) AS card(value)
            WHERE currentRelease."schoolId" = ${schoolId}
              AND currentRelease."visibilityPolicyId" = ${policy.id}
              AND currentRelease."studentCount" > 0
              AND card.value->>'studentId' = pupil."id"
              AND card.value->>'reportStatus' =
                'INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED'
              AND NOT EXISTS (
                SELECT 1 FROM "ReportRecipientRelease" newer
                WHERE newer."schoolId" = currentRelease."schoolId"
                  AND newer."sessionId" = currentRelease."sessionId"
                  AND newer."termId" = currentRelease."termId"
                  AND newer."classId" = currentRelease."classId"
                  AND newer."subjectId" = currentRelease."subjectId"
                  AND newer."releaseOrdinal" > currentRelease."releaseOrdinal"
              )
          ) AS "matches"
        `
      : [];
  return summarizeBrowserFixture({
    schoolActive: school?.isActive,
    policy,
    release,
    targetChildInCurrentRelease:
      targetReleaseEvidence.length === 1 &&
      targetReleaseEvidence[0].matches === true,
    linkedParentChildIds: parents.map((row) => row.studentId),
    linkedStudentChildIds: students.map((row) => row.studentId),
    targetChildId,
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
    const summary = await inspectBrowserFixture(
      prisma,
      schoolId,
      process.env.PHASE8_BROWSER_STUDENT_ID ?? null,
    );
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
