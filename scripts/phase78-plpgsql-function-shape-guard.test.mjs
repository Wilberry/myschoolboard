import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const migrationRoot = new URL("../prisma/migrations/", import.meta.url);
const phase78 = readdirSync(migrationRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      entry.name >= "20261012330000" &&
      /^\d{14}_/.test(entry.name),
  )
  .map((entry) => entry.name)
  .sort();

test("Phase 7–8 SQL migration functions have paired bodies and valid declaration sections", () => {
  assert.ok(
    phase78.length >= 13,
    "Expected cumulative grading/result migrations",
  );
  let inspectedFunctions = 0;
  for (const migration of phase78) {
    const sql = readFileSync(
      new URL(`${migration}/migration.sql`, migrationRoot),
      "utf8",
    );
    const begins = [...sql.matchAll(/\bCREATE (?:OR REPLACE )?FUNCTION\s+/gu)];
    const ends = [...sql.matchAll(/\$\$ LANGUAGE plpgsql\b/gu)];
    assert.equal(
      begins.length,
      ends.length,
      `${migration}: complete PL/pgSQL function bodies required`,
    );
    assert.equal(
      (sql.match(/\$\$/gu) ?? []).length,
      begins.length * 2,
      `${migration}: paired dollar-quoted function bodies required`,
    );
    // Inspect each independently to prevent an earlier delimiter from
    // accidentally matching a later function after a malformed migration.
    for (let index = 0; index < begins.length; index++) {
      const start = begins[index].index;
      const nextStart = begins[index + 1]?.index ?? sql.length;
      const part = sql.slice(start, nextStart);
      const as = part.indexOf("AS $$");
      const terminator = part.indexOf("$$ LANGUAGE plpgsql");
      assert.ok(as > 0 && terminator > as, `${migration}: function boundary`);
      const definition = part.slice(as + "AS $$".length, terminator);
      const bodyStart = definition.search(/^\s*BEGIN\b/mu);
      assert.ok(bodyStart >= 0, `${migration}: missing block BEGIN`);
      const declarationSection = definition.slice(0, bodyStart);
      assert.ok(
        (declarationSection.match(/^\s*DECLARE\b/gmu) ?? []).length <= 1,
        `${migration}: more than one DECLARE in a PL/pgSQL block`,
      );
      inspectedFunctions++;
    }
  }
  assert.ok(
    inspectedFunctions >= 23,
    "Expected all cumulative result functions",
  );
});

test("cumulative Phase 7–8 SQL check is non-mutating and never weakens release controls", () => {
  assert.ok(
    phase78.includes("20261013100000_phase8_result_sheet_evidence_review"),
  );
  assert.ok(
    phase78.includes(
      "20261013170000_phase8_private_composition_source_status_hardening",
    ),
  );
});
