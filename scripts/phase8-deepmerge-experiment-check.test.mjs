import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectDeepmergeCandidate } from "./phase8-deepmerge-experiment-check.mjs";

const pkg = {
  dependencies: { "@prisma/client": "^6.19.3" },
  devDependencies: { prisma: "^6.19.3" },
  overrides: { "@prisma/config": { "deepmerge-ts": "8.0.2" } },
};
const lock = {
  packages: {
    "": {},
    "node_modules/@prisma/config": {
      version: "6.19.3",
      dependencies: { "deepmerge-ts": "7.1.5" },
    },
    "node_modules/deepmerge-ts": {
      version: "8.0.2",
      integrity: "sha512-synthetic-unit-test",
      resolved: "https://registry.npmjs.org/deepmerge-ts/-/deepmerge-ts-8.0.2.tgz",
    },
  },
};

test("accepts a regenerated lock with scoped v8 candidate", () => {
  assert.deepEqual(inspectDeepmergeCandidate(pkg, lock), {
    prismaConfig: "6.19.3",
    deepmerge: "8.0.2",
    integrity: "verified metadata present",
  });
});

test("rejects stale v7, foreign tarballs and missing integrity", () => {
  const original = lock.packages["node_modules/deepmerge-ts"];
  for (const patch of [
    { version: "7.1.5" },
    { resolved: "https://invalid.test/deepmerge-ts.tgz" },
    { integrity: "" },
  ]) {
    const changed = structuredClone(lock);
    changed.packages["node_modules/deepmerge-ts"] = { ...original, ...patch };
    assert.throws(() => inspectDeepmergeCandidate(pkg, changed));
  }
});

test("rejects malformed override and changed Prisma parent", () => {
  const wrongOverride = structuredClone(pkg);
  wrongOverride.overrides["@prisma/config"]["deepmerge-ts"] = "^7.1.5";
  assert.throws(() => inspectDeepmergeCandidate(wrongOverride, lock));
  const wrongParent = structuredClone(lock);
  wrongParent.packages["node_modules/@prisma/config"].version = "7.9.1";
  assert.throws(() => inspectDeepmergeCandidate(pkg, wrongParent));
});

test("refuses hidden older deepmerge-ts copies", () => {
  const changed = structuredClone(lock);
  changed.packages["node_modules/@prisma/config/node_modules/deepmerge-ts"] = {
    version: "7.1.5",
  };
  assert.throws(() => inspectDeepmergeCandidate(pkg, changed));
});
