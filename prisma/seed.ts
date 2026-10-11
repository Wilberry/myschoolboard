import "dotenv/config";
import { auth } from "../src/lib/auth";
import { assertSeedDatabaseTarget } from "../src/lib/database-target";
import { prisma } from "../src/lib/db";

async function main() {
  assertSeedDatabaseTarget();

  const email = process.env.DEV_ADMIN_EMAIL;
  const password = process.env.DEV_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error(
      "Set DEV_ADMIN_EMAIL and a DEV_ADMIN_PASSWORD of at least 12 characters.",
    );
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const result = await auth.api.signUpEmail({
      body: { name: "Demo Administrator", email, password },
    });
    user = await prisma.user.findUnique({ where: { id: result.user.id } });
  }
  if (!user) throw new Error("Could not initialize the development account.");

  const schools = [
    { name: "Northstar Demo School", slug: "northstar-demo" },
    { name: "Lakeview Demo School", slug: "lakeview-demo" },
  ];

  for (const schoolData of schools) {
    const school = await prisma.school.upsert({
      where: { slug: schoolData.slug },
      update: { name: schoolData.name, isActive: true },
      create: schoolData,
    });
    await prisma.membership.upsert({
      where: { schoolId_userId: { schoolId: school.id, userId: user.id } },
      update: { role: "SCHOOL_SUPER_ADMIN", isActive: true },
      create: {
        schoolId: school.id,
        userId: user.id,
        role: "SCHOOL_SUPER_ADMIN",
      },
    });
  }

  console.info(
    JSON.stringify({
      event: "development_seed_complete",
      schoolCount: schools.length,
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "development_seed_failed",
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
