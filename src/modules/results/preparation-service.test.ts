import { beforeEach, describe, expect, it, vi } from "vitest";

const readers = vi.hoisted(() => ({
  objective: vi.fn(),
  manual: vi.fn(),
}));

vi.mock("@/src/modules/assessments/class-record-service", () => ({
  readInternalTeacherClassRecord: readers.objective,
}));
vi.mock("@/src/modules/assessments/reviewed-manual-gradebook-service", () => ({
  readInternalReviewedManualGradebook: readers.manual,
}));
vi.mock("@/src/modules/assessments/question-service", () => ({
  AssessmentError: class extends Error {
    constructor(readonly code: string) {
      super(code);
      this.name = "AssessmentError";
    }
  },
}));

import { readInternalTeacherResultPreparation } from "./preparation-service";

const schoolId = "synthetic-school-a";
const sessionId = "synthetic-session-a";
const termId = "synthetic-term-a";
const classId = "synthetic-class-a";
const subjectId = "synthetic-subject-a";
const ids = [schoolId, sessionId, termId, classId, subjectId] as const;

const pupil = {
  studentId: "synthetic-student-a",
  admissionNumber: "SYN-001",
  givenName: "Ada",
  familyName: "Example",
};

function objectiveSource() {
  return {
    sessionId,
    termId,
    classId,
    subjectId,
    gradingPolicy: null,
    students: [{ ...pupil, assessments: [{}], pendingAssessments: 0 }],
  };
}

function manualSource() {
  return {
    schoolId,
    sessionId,
    termId,
    classId,
    subjectId,
    students: [
      {
        ...pupil,
        components: [{}],
        unapprovedComponents: 0,
        pendingCorrections: 0,
        readyForFurtherAcademicReview: true,
      },
    ],
  };
}

describe("Phase 8 private result source boundary (stubbed authorized readers)", () => {
  beforeEach(() => {
    readers.objective.mockReset();
    readers.manual.mockReset();
    readers.objective.mockResolvedValue(objectiveSource());
    readers.manual.mockResolvedValue(manualSource());
  });

  it("passes the exact academic scope independently to both readers", async () => {
    const result = await readInternalTeacherResultPreparation(...ids);
    expect(readers.objective).toHaveBeenCalledExactlyOnceWith(...ids);
    expect(readers.manual).toHaveBeenCalledExactlyOnceWith(...ids);
    expect(result.status).toBe("PRIVATE_PREPARATION_ONLY");
    expect(result.students).toHaveLength(1);
    expect(result.students[0].status).toBe("SOURCES_RECONCILED_NOT_APPROVED");
    expect(result.students[0].blockers).toContain("GRADING_POLICY_NOT_ADOPTED");
    expect(result.students[0]).not.toHaveProperty("officialGrade");
    expect(result.students[0]).not.toHaveProperty("answerKey");
  });

  it("fails closed if any manual source scope disagrees with the objective read", async () => {
    for (const key of [
      "schoolId",
      "sessionId",
      "termId",
      "classId",
      "subjectId",
    ] as const) {
      readers.manual.mockResolvedValue({
        ...manualSource(),
        [key]: "synthetic-foreign-scope",
      });
      await expect(readInternalTeacherResultPreparation(...ids)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    }
  });

  it("never returns a partial roster when equally sized source rosters disagree", async () => {
    for (const changed of [
      { studentId: "synthetic-student-b" },
      { admissionNumber: "SYN-999" },
      { familyName: "Different" },
    ]) {
      readers.manual.mockResolvedValue({
        ...manualSource(),
        students: [{ ...manualSource().students[0], ...changed }],
      });
      await expect(readInternalTeacherResultPreparation(...ids)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    }
  });

  it("does not disclose the first reader's data when the second reader denies access", async () => {
    readers.manual.mockRejectedValue(new Error("DENIED_AFTER_SOURCE_CHANGE"));
    await expect(readInternalTeacherResultPreparation(...ids)).rejects.toThrow(
      "DENIED_AFTER_SOURCE_CHANGE",
    );
    expect(readers.objective).toHaveBeenCalledExactlyOnceWith(...ids);
    expect(readers.manual).toHaveBeenCalledExactlyOnceWith(...ids);
  });

  it("rejects a mismatched source even when the school, class and subject are valid", async () => {
    readers.objective.mockResolvedValue({
      ...objectiveSource(),
      termId: "synthetic-different-term",
    });
    await expect(readInternalTeacherResultPreparation(...ids)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
