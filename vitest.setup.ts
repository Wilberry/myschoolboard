import "dotenv/config";

const disposableUrl = process.env.TEST_DATABASE_URL;
if (process.env.NODE_ENV !== "test") {
  throw new Error("Database tests require NODE_ENV=test");
}
if (process.env.TEST_DATABASE_DISPOSABLE !== "1") {
  throw new Error(
    "Set TEST_DATABASE_DISPOSABLE=1 for the disposable test database",
  );
}
if (!disposableUrl) {
  throw new Error(
    "TEST_DATABASE_URL must point to the disposable test database",
  );
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(disposableUrl);
} catch {
  throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
}

const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
if (
  !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
  !["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname) ||
  parsedUrl.port !== "5434" ||
  databaseName !== "myschoolboard_test"
) {
  throw new Error(
    "Database tests only run against localhost:5434/myschoolboard_test",
  );
}

// Every Prisma client imported by a test receives the guarded URL, regardless
// of a developer's regular DATABASE_URL setting.
process.env.DATABASE_URL = disposableUrl;
