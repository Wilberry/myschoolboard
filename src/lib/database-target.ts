type Environment = Record<string, string | undefined>;

interface ExpectedTarget {
  port: string;
  database: string;
}

const developmentTarget: ExpectedTarget = {
  port: "5433",
  database: "myschoolboard",
};

const testTarget: ExpectedTarget = {
  port: "5434",
  database: "myschoolboard_test",
};

function assertTarget(
  connectionString: string | undefined,
  expected: ExpectedTarget,
) {
  if (!connectionString) throw new Error("DATABASE_URL is required");

  let target: URL;
  try {
    target = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    target.hostname,
  );
  const database = decodeURIComponent(target.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !isLoopback ||
    target.port !== expected.port ||
    database !== expected.database
  ) {
    throw new Error(
      "DATABASE_URL does not match an approved local database target",
    );
  }
}

export function assertSeedDatabaseTarget(
  environment: Environment = process.env,
) {
  if (environment.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Set ALLOW_DEMO_SEED=1 to explicitly enable demo seeding");
  }

  if (environment.NODE_ENV === "development") {
    assertTarget(environment.DATABASE_URL, developmentTarget);
    return;
  }

  if (
    environment.NODE_ENV === "test" &&
    environment.TEST_DATABASE_DISPOSABLE === "1" &&
    environment.DATABASE_URL === environment.TEST_DATABASE_URL
  ) {
    assertTarget(environment.DATABASE_URL, testTarget);
    return;
  }

  throw new Error(
    "Demo seeding is allowed only for the local development database or the explicitly disposable test database",
  );
}

export function assertLocalResetTarget(environment: Environment = process.env) {
  if (
    environment.NODE_ENV !== "development" ||
    environment.ALLOW_LOCAL_DB_RESET !== "1"
  ) {
    throw new Error(
      "Database reset requires NODE_ENV=development and ALLOW_LOCAL_DB_RESET=1",
    );
  }

  assertTarget(environment.DATABASE_URL, developmentTarget);
}
