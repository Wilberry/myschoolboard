import {
  simulateSchoolGradeScale, validateReportGradeScale,
  type ReportGradeScalePolicy,
} from "./report-grade-scale";
import { validateGradingWeights } from "@/src/modules/assessments/grading-policy";

/** Explicit school-adopted policy. No implicit averaging, precision or release. */
export type CategoryAggregationMethod =
  "EQUAL_ASSESSMENT_BPS" | "POOLED_CATEGORY_POINTS";
export type AggregationPrecision = "HALF_UP" | "FLOOR" | "CEILING";
export interface ReportAggregationPolicy {
  categoryMethod: CategoryAggregationMethod;
  precisionMode: AggregationPrecision;
}
export interface PacketSourceMark {
  kind: "QUIZ" | "TEST" | "EXAM";
  earnedPoints: number;
  maxPoints: number;
  draftId?: string;
  attemptId?: string;
  componentId?: string;
  markId?: string;
  effectivePoints?: number;
}
export interface PrivatePacketStudent {
  studentId: string;
  reportStatus: "INTERNAL_SOURCE_ONLY_NOT_RELEASED";
  quizWeight: number;
  testWeight: number;
  examWeight: number;
  adoptedWeightVersion: number;
  cbt: Array<Pick<PacketSourceMark, "kind" | "earnedPoints" | "maxPoints" | "draftId" | "attemptId">>;
  manual: Array<Pick<PacketSourceMark, "kind" | "maxPoints" | "effectivePoints" | "componentId" | "markId">>;
}
export interface PrivateCompositionInput {
  sourcePacketId: string;
  expectedStudentCount: number;
  students: PrivatePacketStudent[];
  aggregation: ReportAggregationPolicy & { id: string; version: number };
  scale: ReportGradeScalePolicy & { id: string; version: number };
}
export interface PrivateComposedStudent {
  studentId: string;
  rawPercentBps: number;
  displayPercent: string;
  gradeCode: string;
  remark: string;
  categoryPercentBps: { QUIZ: number | null; TEST: number | null; EXAM: number | null };
}
export interface PrivateCompositionSimulation {
  status: "PRIVATE_COMPOSITION_SIMULATION_ONLY";
  sourcePacketId: string;
  aggregationRuleId: string;
  aggregationRuleVersion: number;
  gradeScaleId: string;
  gradeScaleVersion: number;
  studentCount: number;
  students: PrivateComposedStudent[];
}
const kinds = ["QUIZ", "TEST", "EXAM"] as const;
function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value &&
    value.length >= 1 && value.length <= 128;
}
export function validateReportAggregationPolicy(value: unknown): value is ReportAggregationPolicy {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const policy = value as Partial<ReportAggregationPolicy>;
  return ["EQUAL_ASSESSMENT_BPS", "POOLED_CATEGORY_POINTS"].includes(
    policy.categoryMethod as string,
  ) && ["HALF_UP", "FLOOR", "CEILING"].includes(policy.precisionMode as string);
}
/** Integer-only, nonnegative rounding with explicitly adopted precision. */
function divideRounded(numerator: bigint, denominator: bigint,
  mode: AggregationPrecision): number {
  if (numerator < 0n || denominator <= 0n) throw new Error("Invalid score division");
  const base = numerator / denominator;
  const remainder = numerator % denominator;
  const increment = mode === "CEILING" && remainder > 0n ||
    mode === "HALF_UP" && remainder * 2n >= denominator ? 1n : 0n;
  const result = base + increment;
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Score overflow");
  return Number(result);
}

/**
 * PRIVATE, deterministic calculation of score semantics against a frozen,
 * already validated report-card source packet. Not an official report card;
 * no persist/export/public or pupil-facing handler invokes this helper.
 *
 * EQUAL_ASSESSMENT_BPS: round each source fraction to integer basis points,
 * then round the mean within each category to integer basis points.
 * POOLED_CATEGORY_POINTS: round (sum earned)/(sum possible) once per category.
 * Both modes then round the adopted weight sum / 100 to integer basis points.
 * All divisions use the explicitly adopted precisionMode (no JS Math.round).
 */
export function simulatePrivateReportComposition(
  input: PrivateCompositionInput,
): PrivateCompositionSimulation {
  if (!validId(input.sourcePacketId) ||
    !validId(input.aggregation.id) || !validId(input.scale.id) ||
    !Number.isInteger(input.aggregation.version) || input.aggregation.version < 1 ||
    !Number.isInteger(input.scale.version) || input.scale.version < 1 ||
    !validateReportAggregationPolicy(input.aggregation) ||
    !validateReportGradeScale(input.scale) ||
    !Number.isInteger(input.expectedStudentCount) ||
    input.expectedStudentCount < 1 || input.expectedStudentCount > 500 ||
    !Array.isArray(input.students) ||
    input.students.length !== input.expectedStudentCount)
    throw new Error("Invalid or incomplete frozen report composition context");

  const seenPupils = new Set<string>();
  let pinnedWeights: string | null = null;
  const students = input.students.map(pupil => {
    if (!validId(pupil.studentId) || seenPupils.has(pupil.studentId) ||
      pupil.reportStatus !== "INTERNAL_SOURCE_ONLY_NOT_RELEASED" ||
      !validateGradingWeights(pupil) ||
      !Number.isInteger(pupil.adoptedWeightVersion) ||
      pupil.adoptedWeightVersion < 1 ||
      !Array.isArray(pupil.cbt) || !Array.isArray(pupil.manual))
      throw new Error("Invalid or duplicated frozen pupil source");
    seenPupils.add(pupil.studentId);
    const weightKey = [
      pupil.adoptedWeightVersion, pupil.quizWeight,
      pupil.testWeight, pupil.examWeight,
    ].join(":");
    if (pinnedWeights !== null && pinnedWeights !== weightKey)
      throw new Error("Mixed adopted grading policy within frozen packet");
    pinnedWeights = weightKey;

    const marks: Array<{kind: typeof kinds[number]; earned: number; max: number}> = [];
    const seenSources = new Set<string>();
    for (const source of pupil.cbt) {
      if (!validId(source.draftId) || !validId(source.attemptId) ||
        seenSources.has("cbt:" + source.draftId))
        throw new Error("Missing or duplicated scored CBT source");
      seenSources.add("cbt:" + source.draftId);
      marks.push({ kind: source.kind, earned: source.earnedPoints, max: source.maxPoints });
    }
    for (const source of pupil.manual) {
      if (!validId(source.componentId) || !validId(source.markId) ||
        seenSources.has("manual:" + source.componentId))
        throw new Error("Missing or duplicated reviewed manual source");
      seenSources.add("manual:" + source.componentId);
      marks.push({ kind: source.kind, earned: source.effectivePoints as number,
        max: source.maxPoints });
    }
    for (const mark of marks) {
      if (!kinds.includes(mark.kind) ||
        !Number.isSafeInteger(mark.earned) || !Number.isSafeInteger(mark.max) ||
        mark.max <= 0 || mark.earned < 0 || mark.earned > mark.max)
        throw new Error("Invalid or unapproved assessment source points");
    }
    if (!marks.length) throw new Error("Missing assessed source");
    const categoryPercentBps: PrivateComposedStudent["categoryPercentBps"] =
      { QUIZ: null, TEST: null, EXAM: null };
    let weightedSum = 0;
    for (const kind of kinds) {
      const weight = kind === "QUIZ" ? pupil.quizWeight :
        kind === "TEST" ? pupil.testWeight : pupil.examWeight;
      const group = marks.filter(m => m.kind === kind);
      if (!group.length) {
        if (weight > 0) throw new Error("Missing mandatory weighted category");
        continue;
      }
      let catBps: number;
      if (input.aggregation.categoryMethod === "EQUAL_ASSESSMENT_BPS") {
        const bps = group.map(mark =>
          divideRounded(BigInt(mark.earned) * 10000n, BigInt(mark.max),
            input.aggregation.precisionMode));
        catBps = divideRounded(
          bps.reduce((sum, value) => sum + BigInt(value), 0n),
          BigInt(bps.length), input.aggregation.precisionMode);
      } else {
        const earned = group.reduce((sum, mark) => sum + BigInt(mark.earned), 0n);
        const possible = group.reduce((sum, mark) => sum + BigInt(mark.max), 0n);
        catBps = divideRounded(earned * 10000n, possible,
          input.aggregation.precisionMode);
      }
      if (catBps < 0 || catBps > 10000) throw new Error("Invalid computed category");
      categoryPercentBps[kind] = catBps;
      weightedSum += weight * catBps;
    }
    const rawPercentBps = divideRounded(
      BigInt(weightedSum), 100n, input.aggregation.precisionMode);
    const classified = simulateSchoolGradeScale(input.scale, rawPercentBps);
    return {
      studentId: pupil.studentId,
      rawPercentBps, displayPercent: classified.displayPercent,
      gradeCode: classified.gradeCode, remark: classified.remark,
      categoryPercentBps,
    };
  });
  return {
    status: "PRIVATE_COMPOSITION_SIMULATION_ONLY",
    sourcePacketId: input.sourcePacketId,
    aggregationRuleId: input.aggregation.id,
    aggregationRuleVersion: input.aggregation.version,
    gradeScaleId: input.scale.id, gradeScaleVersion: input.scale.version,
    studentCount: input.expectedStudentCount,
    students,
  };
}
