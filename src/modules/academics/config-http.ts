import { randomUUID } from "node:crypto";
import {
  AcademicConfigError,
  createAcademicSession,
  createAcademicTerm,
  createCatalogResource,
} from "./config-service";

type ConfigKind = "session" | "term" | "class" | "subject";

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
    // Diagnostics must not change access-control results.
  }
}

export async function handleAcademicConfigCreate(
  request: Request,
  params: Promise<{ schoolId: string; sessionId?: string }>,
  kind: ConfigKind,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (url.search) return response({ error: "Invalid request" }, 400);
    const { schoolId, sessionId } = await params;
    const input = await request.json();
    const value =
      kind === "session"
        ? await createAcademicSession(schoolId, input)
        : kind === "term"
          ? await createAcademicTerm(schoolId, sessionId ?? "", input)
          : await createCatalogResource(schoolId, kind, input);
    return response({ [kind]: value }, 201);
  } catch (error) {
    if (error instanceof AcademicConfigError) {
      if (error.code === "UNAUTHENTICATED") {
        return response({ error: "Unauthorized" }, 401);
      }
      if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
        safeLog("academic_config_denied");
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
    safeLog("academic_config_failed");
    return response({ error: "Request could not be completed" }, 500);
  }
}
