import { randomUUID } from "node:crypto";
import { AcademicConfigError } from "@/src/modules/academics/config-service";
import {
  assignFormTeacher,
  endFormTeacher,
  handoverFormTeacher,
  updateFormTeacherPolicy,
} from "./service";

function response(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function safeLog(event: string) {
  try {
    console.warn(JSON.stringify({ event, requestId: randomUUID() }));
  } catch {
    // A failed diagnostic logger must not change an access denial.
  }
}

function failure(error: unknown) {
  if (error instanceof AcademicConfigError) {
    if (error.code === "UNAUTHENTICATED") {
      return response({ error: "Unauthorized" }, 401);
    }
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
      safeLog("form_teacher_denied");
      return response({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT") {
      return response({ error: "Invalid request" }, 400);
    }
    if (error.code === "CONFLICT") {
      return response({ error: "Conflict" }, 409);
    }
  }
  if (error instanceof SyntaxError) {
    return response({ error: "Invalid request" }, 400);
  }
  safeLog("form_teacher_failed");
  return response({ error: "Request could not be completed" }, 500);
}

export async function handleAssignFormTeacher(
  request: Request,
  params: Promise<{ schoolId: string }>,
) {
  try {
    if (new URL(request.url).search)
      return response({ error: "Invalid request" }, 400);
    const { schoolId } = await params;
    const body = await request.json();
    const responsibility = await assignFormTeacher(schoolId, body);
    return response({ responsibility }, 201);
  } catch (error) {
    return failure(error);
  }
}

export async function handleHandoverFormTeacher(
  request: Request,
  params: Promise<{ schoolId: string; responsibilityId: string }>,
) {
  try {
    if (new URL(request.url).search)
      return response({ error: "Invalid request" }, 400);
    const { schoolId, responsibilityId } = await params;
    const body = await request.json();
    const responsibility = await handoverFormTeacher(
      schoolId,
      responsibilityId,
      body,
    );
    return response({ responsibility }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleUpdateFormTeacherPolicy(
  request: Request,
  params: Promise<{ schoolId: string }>,
) {
  try {
    if (new URL(request.url).search) {
      return response({ error: "Invalid request" }, 400);
    }
    const { schoolId } = await params;
    const school = await updateFormTeacherPolicy(
      schoolId,
      await request.json(),
    );
    return response({ school }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleEndFormTeacher(
  request: Request,
  params: Promise<{ schoolId: string; responsibilityId: string }>,
) {
  try {
    if (new URL(request.url).search) {
      return response({ error: "Invalid request" }, 400);
    }
    const { schoolId, responsibilityId } = await params;
    const responsibility = await endFormTeacher(
      schoolId,
      responsibilityId,
      await request.json(),
    );
    return response({ responsibility }, 200);
  } catch (error) {
    return failure(error);
  }
}
