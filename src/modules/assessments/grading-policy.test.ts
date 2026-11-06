import { describe, expect, it } from "vitest";
import {
  calculateWeightedPreview,
  validateGradingWeights,
} from "./grading-policy";

describe("explicit school-owned draft grading weights (provisional only)", () => {
  const weights = { quizWeight: 20, testWeight: 30, examWeight: 50 };
  it("accepts precisely 100% integer weights; no implicit default", () => {
    expect(validateGradingWeights(weights)).toBe(true);
    expect(
      validateGradingWeights({
        quizWeight: 30,
        testWeight: 30,
        examWeight: 30,
      }),
    ).toBe(false);
    expect(
      validateGradingWeights({
        quizWeight: -1,
        testWeight: 51,
        examWeight: 50,
      }),
    ).toBe(false);
    expect(
      validateGradingWeights({
        quizWeight: 0.5,
        testWeight: 49.5,
        examWeight: 50,
      }),
    ).toBe(false);
  });
  it("calculates independent category means then the explicit category weights", () => {
    const result = calculateWeightedPreview(weights, [
      { kind: "QUIZ", percentBps: 6000 },
      { kind: "QUIZ", percentBps: 8000 },
      { kind: "TEST", percentBps: 5000 },
      { kind: "EXAM", percentBps: 9000 },
    ]);
    expect(result.status).toBe("READY");
    expect(result.weightedPercentBps).toBe(7400); // 0.2*70+0.3*50+0.5*90
  });
  it("hides the weighted preview when a required category is missing or unscored", () => {
    const absent = calculateWeightedPreview(weights, [
      { kind: "QUIZ", percentBps: 10000 },
      { kind: "TEST", percentBps: 4000 },
    ]);
    expect(absent).toMatchObject({
      status: "PENDING",
      weightedPercentBps: null,
    });
    const unscored = calculateWeightedPreview(weights, [
      { kind: "QUIZ", percentBps: 10000 },
      { kind: "TEST", percentBps: 4000 },
      { kind: "EXAM", percentBps: null },
    ]);
    expect(unscored.weightedPercentBps).toBeNull();
  });
  it("ignores optional zero-weight categories without converting missing to zeros", () => {
    const result = calculateWeightedPreview(
      {
        quizWeight: 0,
        testWeight: 0,
        examWeight: 100,
      },
      [
        { kind: "EXAM", percentBps: 7500 },
        { kind: "QUIZ", percentBps: null },
      ],
    );
    expect(result).toMatchObject({ status: "READY", weightedPercentBps: 7500 });
  });
  it("rejects invalid grade inputs rather than producing fictitious marks", () => {
    expect(() =>
      calculateWeightedPreview(weights, [{ kind: "EXAM", percentBps: 10001 }]),
    ).toThrow();
    expect(() =>
      calculateWeightedPreview(weights, [{ kind: "EXAM", percentBps: -1 }]),
    ).toThrow();
  });
});
