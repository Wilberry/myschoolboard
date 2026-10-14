import { describe, expect, it } from "vitest";
import {
  simulateSchoolGradeScale,
  validateReportGradeScale,
  type ReportGradeScalePolicy,
} from "./report-grade-scale";

const bands = [
  { code: "F", remark: "School-selected lower band", minBps: 0, maxBps: 5999 },
  {
    code: "B",
    remark: "School-selected middle band",
    minBps: 6000,
    maxBps: 7999,
  },
  {
    code: "A",
    remark: "School-selected upper band",
    minBps: 8000,
    maxBps: 10000,
  },
];
const policy: ReportGradeScalePolicy = {
  bands,
  decimalPlaces: 0,
  roundingMode: "HALF_UP",
  bandBasis: "RAW_BPS",
};
describe("Phase 8 explicitly adopted school grade scale (pure private simulation)", () => {
  it("rejects gaps, overlap, reversed and unbounded bands", () => {
    expect(validateReportGradeScale(policy)).toBe(true);
    for (const broken of [
      [{ ...bands[0], maxBps: 5998 }, ...bands.slice(1)],
      [{ ...bands[0], maxBps: 6000 }, ...bands.slice(1)],
      [{ ...bands[0], minBps: 1 }, ...bands.slice(1)],
      [...bands.slice(0, 2), { ...bands[2], maxBps: 9999 }],
      [...bands.slice(0, 2), { ...bands[2], maxBps: 10001 }],
      [bands[0], { ...bands[1], minBps: 7000 }, bands[2]],
      [{ ...bands[0], minBps: -1 }, ...bands.slice(1)],
    ])
      expect(validateReportGradeScale({ ...policy, bands: broken })).toBe(
        false,
      );
  });
  it("rejects duplicate code, invalid labels, missing rule and fake numeric inputs", () => {
    for (const candidate of [
      { ...policy, bands: [{ ...bands[0], code: "b" }, ...bands.slice(1)] },
      { ...policy, bands: [{ ...bands[0], code: "  " }, ...bands.slice(1)] },
      {
        ...policy,
        bands: [{ ...bands[0], remark: "Bad\nremark" }, ...bands.slice(1)],
      },
      { ...policy, bands: [{ ...bands[0], minBps: 0.5 }, ...bands.slice(1)] },
      { ...policy, bands: [{ ...bands[0], maxBps: NaN }, ...bands.slice(1)] },
      {
        ...policy,
        bands: [{ ...bands[0], injectedMark: 40 }, ...bands.slice(1)],
      },
      { ...policy, decimalPlaces: 3 },
      { ...policy, bandBasis: "UNCONFIGURED" },
      { ...policy, roundingMode: "BANKERS" },
      { ...policy, bands: [] },
    ])
      expect(validateReportGradeScale(candidate)).toBe(false);
    expect(validateReportGradeScale(null)).toBe(false);
  });
  it("resolves all 0..10000 basis-point threshold edges without fallback", () => {
    expect(simulateSchoolGradeScale(policy, 0).gradeCode).toBe("F");
    expect(simulateSchoolGradeScale(policy, 5999).gradeCode).toBe("F");
    expect(simulateSchoolGradeScale(policy, 6000).gradeCode).toBe("B");
    expect(simulateSchoolGradeScale(policy, 7999).gradeCode).toBe("B");
    expect(simulateSchoolGradeScale(policy, 8000).gradeCode).toBe("A");
    expect(simulateSchoolGradeScale(policy, 10000).gradeCode).toBe("A");
    expect(() => simulateSchoolGradeScale(policy, -1)).toThrow();
    expect(() => simulateSchoolGradeScale(policy, 10001)).toThrow();
    expect(() => simulateSchoolGradeScale(policy, 50.5)).toThrow();
  });
  it("supports explicit decimal precision and three deterministic rounding modes", () => {
    const base = { ...policy, decimalPlaces: 0 as const };
    expect(simulateSchoolGradeScale(base, 7550).displayPercent).toBe("76");
    expect(
      simulateSchoolGradeScale({ ...base, roundingMode: "FLOOR" }, 7599)
        .displayPercent,
    ).toBe("75");
    expect(
      simulateSchoolGradeScale({ ...base, roundingMode: "CEILING" }, 7501)
        .displayPercent,
    ).toBe("76");
    expect(
      simulateSchoolGradeScale({ ...base, decimalPlaces: 1 }, 7545)
        .displayPercent,
    ).toBe("75.5");
    expect(
      simulateSchoolGradeScale({ ...base, decimalPlaces: 2 }, 7545)
        .displayPercent,
    ).toBe("75.45");
    expect(
      simulateSchoolGradeScale({ ...base, roundingMode: "CEILING" }, 10000)
        .displayPercent,
    ).toBe("100");
  });
  it("makes raw-vs-displayed grade-band classification an explicit school choice", () => {
    const raw = simulateSchoolGradeScale(policy, 7999);
    const displayed = simulateSchoolGradeScale(
      {
        ...policy,
        bandBasis: "DISPLAY_ROUNDED_BPS",
      },
      7999,
    );
    expect(raw).toMatchObject({
      gradeCode: "B",
      displayPercent: "80",
      status: "PRIVATE_POLICY_SIMULATION_ONLY",
    });
    expect(displayed).toMatchObject({
      gradeCode: "A",
      displayPercent: "80",
      status: "PRIVATE_POLICY_SIMULATION_ONLY",
    });
  });
});
