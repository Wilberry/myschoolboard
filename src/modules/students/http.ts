import { randomUUID } from "node:crypto";
import { AcademicConfigError } from "@/src/modules/academics/config-service";
import { enrollStudent, registerStudent, withdrawStudent } from "./service";

function reply(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function failure(error: unknown) {
  if (error instanceof AcademicConfigError) {
    if (error.code === "UNAUTHENTICATED") {
      return reply({ error: "Unauthorized" }, 401);
    }
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
      return reply({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT") {
      return reply({ error: "Invalid request" }, 400);
    }
    if (error.code === "CONFLICT") {
      return reply({ error: "Conflict" }, 409);
    }
  }
  if (error instanceof SyntaxError) {
    return reply({ error: "Invalid request" }, 400);
  }
  try {
    console.warn(JSON.stringify({
      event: "student_enrollment_mutation_failed",
      requestId: randomUUID(),
    }));
  } catch {
    // Never log student identities, names, admission codes or private data.
  }
  return reply({ error: "Request could not be completed" }, 500);
}

export async function handleStudentMutation(
  request: Request,
  params: Promise<{
    schoolId: string;
    studentId?: string;
    enrollmentId?: string;
  }>,
  action: "register" | "enroll" | "withdraw",
): Promise<Response> {
  try {
    if (new URL(request.url).search) {
      return reply({ error: "Invalid request" }, 400);
    }
    const { schoolId, studentId, enrollmentId } = await params;
    const input = await request.json();
    if (action === "register") {
      return reply({ student: await registerStudent(schoolId, input) }, 201);
    }
    if (!studentId) return reply({ error: "Invalid request" }, 400);
    if (action === "enroll") {
      return reply({
        enrollment: await enrollStudent(schoolId, studentId, input),
      }, 201);
    }
    if (!enrollmentId) return reply({ error: "Invalid request" }, 400);
    return reply({
      enrollment: await withdrawStudent(
        schoolId, studentId, enrollmentId, input,
      ),
    }, 200);
  } catch (error) {
    return failure(error);
  }
}
