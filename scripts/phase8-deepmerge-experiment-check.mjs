import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export function inspectDeepmergeCandidate(pkg, lock) {
  assert.equal(pkg.dependencies["@prisma/client"], "^6.19.3");
  assert.equal(pkg.devDependencies.prisma, "^6.19.3");
  assert.equal(
    pkg.overrides?.["@prisma/config"]?.["deepmerge-ts"],
    "8.0.2",
    "Only @prisma/config should override deepmerge-ts to 8.0.2",
  );
  const parent = lock.packages?.["node_modules/@prisma/config"];
  assert.equal(parent?.version, "6.19.3");
  assert.equal(parent?.dependencies?.["deepmerge-ts"], "7.1.5");
  const resolved = lock.packages?.["node_modules/deepmerge-ts"];
  assert.equal(
    resolved?.version,
    "8.0.2",
    "Regenerate package-lock.json in the isolated experiment before npm ci",
  );
  assert.ok(resolved.integrity?.startsWith("sha512-"), "Missing npm integrity");
  assert.ok(
    resolved.resolved?.startsWith("https://registry.npmjs.org/deepmerge-ts/"),
    "Unexpected package source",
  );
  assert.equal(lock.packages[""].overrides?.["@prisma/config"]?.["deepmerge-ts"], "8.0.2");
  return {
    prismaConfig: parent.version,
    deepmerge: resolved.version,
    integrity: "verified metadata present",
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    const lock = JSON.parse(
      readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
    );
    const outcome = inspectDeepmergeCandidate(pkg, lock);
    console.info("Isolated Prisma deepmerge candidate:", outcome);
    console.info(
      "Lock graph inspection passed; full npm ci, Prisma/migration/test/build/audit still required",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Candidate not ready");
    process.exitCode = 1;
  }
}
