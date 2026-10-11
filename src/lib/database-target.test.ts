import { describe, expect, it } from "vitest";
import {
  assertLocalResetTarget,
  assertSeedDatabaseTarget,
} from "./database-target";

const developmentUrl =
  "postgresql://myschoolboard:local_dev_password@localhost:5433/myschoolboard?schema=public";
const testUrl =
  "postgresql://myschoolboard:local_test_password@localhost:5434/myschoolboard_test?schema=public";

describe("database target guards", () => {
  it("allows demo seeding only for the opted-in local development database", () => {
    expect(() =>
      assertSeedDatabaseTarget({
        NODE_ENV: "development",
        DATABASE_URL: developmentUrl,
        ALLOW_DEMO_SEED: "1",
      }),
    ).not.toThrow();
  });

  it("allows demo seeding on the explicitly disposable test database", () => {
    expect(() =>
      assertSeedDatabaseTarget({
        NODE_ENV: "test",
        DATABASE_URL: testUrl,
        TEST_DATABASE_URL: testUrl,
        TEST_DATABASE_DISPOSABLE: "1",
        ALLOW_DEMO_SEED: "1",
      }),
    ).not.toThrow();
  });

  it.each([
    {
      name: "a production environment",
      environment: {
        NODE_ENV: "production",
        DATABASE_URL: developmentUrl,
        ALLOW_DEMO_SEED: "1",
      },
    },
    {
      name: "a non-loopback database",
      environment: {
        NODE_ENV: "development",
        DATABASE_URL:
          "postgresql://myschoolboard:password@db.example:5433/myschoolboard",
        ALLOW_DEMO_SEED: "1",
      },
    },
    {
      name: "a development database without explicit opt-in",
      environment: {
        NODE_ENV: "development",
        DATABASE_URL: developmentUrl,
      },
    },
    {
      name: "a test database without the disposable marker",
      environment: {
        NODE_ENV: "test",
        DATABASE_URL: testUrl,
        TEST_DATABASE_URL: testUrl,
        ALLOW_DEMO_SEED: "1",
      },
    },
    {
      name: "a mismatched test connection string",
      environment: {
        NODE_ENV: "test",
        DATABASE_URL: developmentUrl,
        TEST_DATABASE_URL: testUrl,
        TEST_DATABASE_DISPOSABLE: "1",
        ALLOW_DEMO_SEED: "1",
      },
    },
  ])("rejects seeding against $name", ({ environment }) => {
    expect(() => assertSeedDatabaseTarget(environment)).toThrow();
  });

  it("requires explicit opt-in and the local development target for reset", () => {
    expect(() =>
      assertLocalResetTarget({
        NODE_ENV: "development",
        DATABASE_URL: developmentUrl,
        ALLOW_LOCAL_DB_RESET: "1",
      }),
    ).not.toThrow();

    expect(() =>
      assertLocalResetTarget({
        NODE_ENV: "development",
        DATABASE_URL: developmentUrl,
      }),
    ).toThrow();
  });

  it.each([
    {
      name: "a shared host",
      databaseUrl:
        "postgresql://myschoolboard:password@db.example:5433/myschoolboard",
    },
    {
      name: "the disposable test database",
      databaseUrl: testUrl,
    },
    {
      name: "a differently named local database",
      databaseUrl:
        "postgresql://myschoolboard:password@localhost:5433/production",
    },
  ])("rejects reset against $name", ({ databaseUrl }) => {
    expect(() =>
      assertLocalResetTarget({
        NODE_ENV: "development",
        DATABASE_URL: databaseUrl,
        ALLOW_LOCAL_DB_RESET: "1",
      }),
    ).toThrow();
  });
});
