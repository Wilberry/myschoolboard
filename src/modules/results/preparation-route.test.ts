import { beforeEach, describe, expect, it, vi } from "vitest";

const reader = vi.hoisted(() => vi.fn());
vi.mock("@/src/modules/results/preparation-service", () => ({
  readInternalTeacherResultPreparation: reader,
}));
vi.mock("@/src/modules/assessments/question-service", () => ({
  AssessmentError: class extends Error {
    constructor(readonly code: string) {
      super(code);
      this.name = "AssessmentError";
    }
  },
}));

import { GET } from "@/app/api/schools/[schoolId]/result-preparation/route";
import { AssessmentError } from "@/src/modules/assessments/question-service";

const schoolId = "synthetic-school-a";
const scope = {
  classId: "synthetic-class-a",
  sessionId: "synthetic-session-a",
  termId: "synthetic-term-a",
  subjectId: "synthetic-subject-a",
};

const endpoint = `http://localhost/api/schools/${schoolId}/result-preparation`;

function call(query: string) {
  return GET(new Request(`${endpoint}?${query}`), {
    params: Promise.resolve({ schoolId }),
  });
}

const validQuery = new URLSearchParams(scope).toString();

describe("Phase 8 private preparation route", () => {
  beforeEach(() => reader.mockReset());

  it("returns private preparation for an exact scoped read", async () => {
    reader.mockResolvedValue({
      status: "PRIVATE_PREPARATION_ONLY",
      studentCount: 0,
      blockedCount: 0,
      students: [],
    });

    const response = await call(validQuery);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const payload = await response.json();
    expect(payload.preparation.status).toBe("PRIVATE_PREPARATION_ONLY");
    expect(payload.preparation.students).toEqual([]);
    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader).toHaveBeenCalledWith(
      schoolId,
      scope.sessionId,
      scope.termId,
      scope.classId,
      scope.subjectId,
    );
  });

  it("rejects malformed and duplicate query parameters", async () => {
    for (const query of [
      "",
      "classId=synthetic-class-a",
      `${validQuery}&classId=another`,
      `${validQuery}&studentId=synthetic-student-a`,
    ]) {
      const response = await call(query);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: "Invalid request" });
    }
    expect(reader).not.toHaveBeenCalled();
  });

  it("conceals denied or missing scopes with a generic 404", async () => {
    for (const code of ["FORBIDDEN", "NOT_FOUND"] as const) {
      reader.mockImplementation(async () => {
        throw new AssessmentError(code);
      });
      const response = await call(validQuery);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: "Not found" });
    }
  });

  it("never discloses partial roster on reader conflict", async () => {
    reader.mockImplementation(async () => {
      throw new AssessmentError("CONFLICT");
    });
    const response = await call(validQuery);
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Conflict" });
  });

  it("hides errors after expiration or internal failure", async () => {
    reader.mockImplementation(async () => {
      throw new AssessmentError("UNAUTHENTICATED");
    });
    const unauthorized = await call(validQuery);
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ error: "Unauthorized" });

    reader.mockImplementation(async () => {
      throw new Error("synthetic-pupil-name-and-admission-should-not-leak");
    });
    const failure = await call(validQuery);
    expect(failure.status).toBe(500);
    expect(failure.headers.get("cache-control")).toBe("private, no-store");
    expect(await failure.json()).toEqual({ error: "Request failed" });
  });
});
