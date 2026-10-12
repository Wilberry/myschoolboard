import { randomUUID } from "node:crypto";
import { AcademicConfigError } from "@/src/modules/academics/config-service";
import { assignClassToSection, createSchoolSection } from "./service";

function respond(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function failure(error: unknown) {
  if (error instanceof AcademicConfigError) {
    if (error.code === "UNAUTHENTICATED") {
      return respond({ error: "Unauthorized" }, 401);
    }
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
      return respond({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT") {
      return respond({ error: "Invalid request" }, 400);
    }
    if (error.code === "CONFLICT") {
      return respond({ error: "Conflict" }, 409);
    }
  }
  if (error instanceof SyntaxError) {
    return respond({ error: "Invalid request" }, 400);
  }
  try {
    console.warn(JSON.stringify({
      event: "school_section_mutation_failed",
      requestId: randomUUID(),
    }));
  } catch {
    // Operational diagnostics must never reveal tenant IDs or stored data.
  }
  return respond({ error: "Request could not be completed" }, 500);
}

export async function handleSectionMutation(
  request: Request,
  params: Promise<{ schoolId: string; classId?: string }>,
  operation: "create" | "assign",
): Promise<Response> {
  try {
    if (new URL(request.url).search) {
      return respond({ error: "Invalid request" }, 400);
    }
    const { schoolId, classId } = await params;
    const input = await request.json();
    if (operation === "create") {
      const section = await createSchoolSection(schoolId, input);
      return respond({ section }, 201);
    }
    if (!classId) return respond({ error: "Invalid request" }, 400);
    const schoolClass = await assignClassToSection(schoolId, classId, input);
    return respond({ class: schoolClass }, 200);
  } catch (error) {
    return failure(error);
  }
}
