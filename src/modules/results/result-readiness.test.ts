import { describe, expect, it } from "vitest";
import { reconcileResultPreparation } from "./result-readiness";

const child = {
  studentId: "synthetic-student-1",
  admissionNumber: "DEMO-001",
  givenName: "Ada",
  familyName: "Example",
};
describe("Phase 8 private result source preflight", () => {
  it("never converts academic source completion into result publication", () => {
    const result = reconcileResultPreparation(
      [{ ...child, assessmentCount: 2, unscoredCount: 0 }],
      [{ ...child, componentCount: 1, unapprovedCount: 0,
        pendingCorrections: 0, academicallyComplete: true }],
      2,
    );
    expect(result.status).toBe("PRIVATE_PREPARATION_ONLY");
    expect(result.students[0]).toMatchObject({
      status: "SOURCES_RECONCILED_NOT_APPROVED",
      blockers: ["GRADING_POLICY_NOT_ADOPTED"],
    });
  });
  it("keeps missing marks and pending correction visible without fabricated grades", () => {
    const result = reconcileResultPreparation(
      [{ ...child, assessmentCount: 3, unscoredCount: 1 }],
      [{ ...child, componentCount: 2, unapprovedCount: 1,
        pendingCorrections: 1, academicallyComplete: false }],
      null,
    );
    expect(result.blockedCount).toBe(1);
    expect(result.students[0].blockers).toContain("OBJECTIVE_SCORING_PENDING");
    expect(result.students[0].blockers).toContain("MANUAL_REVIEW_PENDING");
    expect(result.students[0].blockers).toContain("MANUAL_CORRECTION_PENDING");
  });
  it("returns no assessment source if both sets contain no components", () => {
    expect(reconcileResultPreparation(
      [{ ...child, assessmentCount: 0, unscoredCount: 0 }],
      [{ ...child, componentCount: 0, unapprovedCount: 0,
        pendingCorrections: 0, academicallyComplete: false }], null,
    ).students[0].blockers).toContain("NO_ASSESSMENT_SOURCE");
  });
  it("refuses extra/missing/mismatched or duplicate pupil identities", () => {
    const o = [{ ...child, assessmentCount: 1, unscoredCount: 0 }];
    const m = [{ ...child, componentCount: 1, unapprovedCount: 0,
      pendingCorrections: 0, academicallyComplete: true }];
    expect(() => reconcileResultPreparation(o, [], null)).toThrow();
    expect(() => reconcileResultPreparation([], m, null)).toThrow();
    expect(() => reconcileResultPreparation(o, [{ ...m[0],
      studentId: "another-student" }], null)).toThrow();
    expect(() => reconcileResultPreparation(o, [{ ...m[0],
      familyName: "Another" }], null)).toThrow();
    expect(() => reconcileResultPreparation([...o, ...o], m, null)).toThrow();
    expect(() => reconcileResultPreparation(o, [...m, ...m], null)).toThrow();
  });
  it("rejects inconsistent counters and unbounded preview breadth", () => {
    const o = [{ ...child, assessmentCount: 1, unscoredCount: 2 }];
    const m = [{ ...child, componentCount: 1, unapprovedCount: 0,
      pendingCorrections: 0, academicallyComplete: true }];
    expect(() => reconcileResultPreparation(o, m, null)).toThrow();
    expect(() => reconcileResultPreparation(
      [{ ...child, assessmentCount: 1, unscoredCount: 0 }],
      m, -1,
    )).toThrow();
    expect(() => reconcileResultPreparation(
      Array.from({ length: 501 }, (_, i) => ({
        ...child, studentId: String(i), assessmentCount: 0, unscoredCount: 0,
      })), m, null,
    )).toThrow();
  });
});
