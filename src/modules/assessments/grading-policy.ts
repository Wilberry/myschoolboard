/** Pure, preview-only weighting; NEVER an official grade or publication rule.
 * No silent fallback weights. Each nonzero category must have >=1 assessment
 * and ALL such assessments must be scored before showing a weighted preview. */
export type AssessmentCategory = "QUIZ" | "TEST" | "EXAM";
export interface GradingWeights {
  quizWeight: number;
  testWeight: number;
  examWeight: number;
}
export interface ProvisionalAssessment {
  kind: AssessmentCategory;
  percentBps: number | null;
}
export interface WeightedPreview {
  status: "PENDING" | "READY";
  weightedPercentBps: number | null;
  categories: Array<{
    kind: AssessmentCategory;
    weight: number;
    total: number;
    pending: number;
    averagePercentBps: number | null;
  }>;
}
export function validateGradingWeights(value: GradingWeights): boolean {
  return (
    [value.quizWeight, value.testWeight, value.examWeight].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 100,
    ) && value.quizWeight + value.testWeight + value.examWeight === 100
  );
}
export function calculateWeightedPreview(
  weights: GradingWeights,
  assessments: readonly ProvisionalAssessment[],
): WeightedPreview {
  if (
    !validateGradingWeights(weights) ||
    assessments.some(
      (a) =>
        !["QUIZ", "TEST", "EXAM"].includes(a.kind) ||
        (a.percentBps !== null &&
          (!Number.isInteger(a.percentBps) ||
            a.percentBps < 0 ||
            a.percentBps > 10000)),
    )
  ) {
    throw new Error("Invalid provisional grade preview inputs");
  }
  const categories: WeightedPreview["categories"] = [];
  let weightedSum = 0;
  let pendingRequired = false;
  for (const [kind, weight] of [
    ["QUIZ", weights.quizWeight],
    ["TEST", weights.testWeight],
    ["EXAM", weights.examWeight],
  ] as const) {
    const entries = assessments.filter((a) => a.kind === kind);
    const pending = entries.filter((a) => a.percentBps === null).length;
    const complete = entries.length > 0 && pending === 0;
    const averagePercentBps = complete
      ? entries.reduce((sum, a) => sum + (a.percentBps ?? 0), 0) /
        entries.length
      : null;
    if (weight > 0 && !complete) pendingRequired = true;
    if (weight > 0 && averagePercentBps !== null) {
      weightedSum += weight * averagePercentBps;
    }
    categories.push({
      kind,
      weight,
      total: entries.length,
      pending,
      averagePercentBps:
        averagePercentBps === null ? null : Math.round(averagePercentBps),
    });
  }
  return {
    status: pendingRequired ? "PENDING" : "READY",
    weightedPercentBps: pendingRequired ? null : Math.round(weightedSum / 100),
    categories,
  };
}
