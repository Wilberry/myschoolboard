import { describe, expect, it } from "vitest";
import {
  simulatePrivateReportComposition, validateReportAggregationPolicy,
  type PrivateCompositionInput,
} from "./report-composition-simulation";

const source = {
  studentId: "pupil-one",
  adoptedWeightVersion: 2,
  reportStatus: "INTERNAL_SOURCE_ONLY_NOT_RELEASED" as const,
  quizWeight: 20, testWeight: 30, examWeight: 50,
  cbt: [
    { draftId: "quiz-one", attemptId: "attempt-one",
      kind: "QUIZ" as const, earnedPoints: 1, maxPoints: 2 },
    { draftId: "quiz-two", attemptId: "attempt-two",
      kind: "QUIZ" as const, earnedPoints: 1, maxPoints: 4 },
    { draftId: "exam", attemptId: "attempt-exam",
      kind: "EXAM" as const, earnedPoints: 8, maxPoints: 10 },
  ],
  manual: [
    { componentId: "test-one", markId: "mark-one",
      kind: "TEST" as const, effectivePoints: 6, maxPoints: 10 },
  ],
};
const base: PrivateCompositionInput = {
  sourcePacketId: "frozen-packet-one", expectedStudentCount: 1,
  students: [source],
  aggregation: {
    id: "adopted-rule-one", version: 1,
    categoryMethod: "EQUAL_ASSESSMENT_BPS", precisionMode: "HALF_UP",
  },
  scale: {
    id: "adopted-scale-one", version: 3,
    decimalPlaces: 2, roundingMode: "HALF_UP", bandBasis: "RAW_BPS",
    bands: [
      { code: "F", remark: "Lower band", minBps: 0, maxBps: 5999 },
      { code: "B", remark: "Middle band", minBps: 6000, maxBps: 6999 },
      { code: "A", remark: "Upper band", minBps: 7000, maxBps: 10000 },
    ],
  },
};
describe("Phase 8 private policy-pinned report composition mathematics", () => {
  it("requires school-selected aggregation and precision; no implicit default", () => {
    expect(validateReportAggregationPolicy(base.aggregation)).toBe(true);
    for (const candidate of [
      { categoryMethod: "UNKNOWN", precisionMode: "HALF_UP" },
      { categoryMethod: "EQUAL_ASSESSMENT_BPS" },
      { precisionMode: "HALF_UP" }, null, "HALF_UP",
    ]) expect(validateReportAggregationPolicy(candidate)).toBe(false);
  });
  it("uses equal assessment normalized percentages, then pinned weight and scale", () => {
    const result = simulatePrivateReportComposition(base);
    expect(result).toMatchObject({
      status: "PRIVATE_COMPOSITION_SIMULATION_ONLY",
      sourcePacketId: "frozen-packet-one",
      aggregationRuleVersion: 1, gradeScaleVersion: 3, studentCount: 1,
      students: [{ studentId: "pupil-one",
        rawPercentBps: 6550, displayPercent: "65.50",
        gradeCode: "B",
        categoryPercentBps: { QUIZ: 3750, TEST: 6000, EXAM: 8000 } }],
    });
  });
  it("pools category points when the school adopts pooled points", () => {
    const result = simulatePrivateReportComposition({
      ...base,
      aggregation: { ...base.aggregation,
        categoryMethod: "POOLED_CATEGORY_POINTS" },
    });
    expect(result.students[0]).toMatchObject({
      rawPercentBps: 6467, displayPercent: "64.67",
      categoryPercentBps: { QUIZ: 3333, TEST: 6000, EXAM: 8000 },
    });
  });
  it("rejects incomplete, forged, duplicated or corrupt frozen sources", () => {
    const rejected = [
      [source, source],
      [{ ...source, reportStatus: "PUBLISHED" }],
      [{ ...source, cbt: source.cbt.slice(0, 2) }],
      [{ ...source, manual: [] }],
      [{ ...source, cbt: [...source.cbt, source.cbt[0]] }],
      [{ ...source, cbt: [{ ...source.cbt[0], earnedPoints: -1 },
        ...source.cbt.slice(1)] }],
      [{ ...source, cbt: [{ ...source.cbt[0], earnedPoints: 3 },
        ...source.cbt.slice(1)] }],
      [{ ...source, cbt: [{ ...source.cbt[0], maxPoints: 0 },
        ...source.cbt.slice(1)] }],
      [{ ...source, manual: [{ ...source.manual[0],
        effectivePoints: NaN }] }],
      [{ ...source, adoptedWeightVersion: 0 }],
      [{ ...source, quizWeight: 10 }],
    ];
    for (const students of rejected) {
      const attempt: PrivateCompositionInput = {
        ...base, expectedStudentCount: students.length,
        students: students as PrivateCompositionInput["students"],
      };
      expect(() => simulatePrivateReportComposition(attempt)).toThrow();
    }
  });
  it("does not combine different adopted weighting versions across pupils", () => {
    expect(() => simulatePrivateReportComposition({
      ...base, expectedStudentCount: 2, students: [source,
        { ...source, studentId: "pupil-two", adoptedWeightVersion: 3 }],
    })).toThrow();
  });
  it("permits no-source optional zero-weight category without inventing zero", () => {
    const examOnly = { ...source, quizWeight: 0, testWeight: 0,
      examWeight: 100, cbt: [source.cbt[2]], manual: [] };
    expect(simulatePrivateReportComposition({
      ...base, students: [examOnly],
    }).students[0]).toMatchObject({
      rawPercentBps: 8000, categoryPercentBps:
        { QUIZ: null, TEST: null, EXAM: 8000 },
    });
  });
  it("uses explicit precision policy on fractional source fractions", () => {
    const third = { ...source, quizWeight: 100, testWeight: 0,
      examWeight: 0, cbt: [{ ...source.cbt[0], earnedPoints: 1, maxPoints: 3 }],
      manual: [] };
    const rounded = (precisionMode: "HALF_UP" | "FLOOR" | "CEILING") =>
      simulatePrivateReportComposition({
        ...base, students: [third],
        aggregation: { ...base.aggregation, precisionMode },
      }).students[0].rawPercentBps;
    expect(rounded("FLOOR")).toBe(3333);
    expect(rounded("HALF_UP")).toBe(3333);
    expect(rounded("CEILING")).toBe(3334);
  });
  it("rejects forged scale context rather than labeling grades with fallback", () => {
    expect(() => simulatePrivateReportComposition({
      ...base, scale: { ...base.scale, bands: [] },
    })).toThrow();
    expect(() => simulatePrivateReportComposition({
      ...base, aggregation: { ...base.aggregation, version: 0 },
    })).toThrow();
    expect(() => simulatePrivateReportComposition({
      ...base, sourcePacketId: " ",
    })).toThrow();
  });
});
