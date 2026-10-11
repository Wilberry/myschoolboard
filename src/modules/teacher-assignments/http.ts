import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";
import { AssignmentServiceError } from "./service";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value === value.trim());

export const createAssignmentBody = z
  .object({
    teacherMembershipId: identifier,
    classId: identifier,
    subjectId: identifier,
  })
  .strict();

export const reasonBody = z
  .object({ reason: z.string().trim().min(1).max(500) })
  .strict();

export const optionalReasonBody = z
  .object({ reason: z.string().trim().min(1).max(500).optional() })
  .strict();

interface RouteParams {
  schoolId: string;
  assignmentId?: string;
}

interface MutationOptions<TBody extends Record<string, unknown>> {
  request: Request;
  params: Promise<RouteParams>;
  schema: z.ZodType<TBody>;
  operation: "create" | "deactivate" | "revoke" | "reactivate";
  status?: number;
  mutate: (input: TBody & RouteParams) => Promise<unknown>;
}

interface SafeLogContext {
  operation?: "create" | "deactivate" | "revoke" | "reactivate";
  errorType?: string;
}

function safeLog(
  event: string,
  requestId: string,
  context: SafeLogContext = {},
) {
  try {
    console.warn(
      JSON.stringify({
        event,
        requestId,
        ...context,
      }),
    );
  } catch {
    // Logging failure must never turn a denial into an allowed request.
  }
}

function errorResponse(
  error: unknown,
  requestId: string,
  context: SafeLogContext,
): Response {
  if (error instanceof AssignmentServiceError) {
    switch (error.code) {
      case "UNAUTHENTICATED":
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      case "FORBIDDEN":
      case "NOT_FOUND":
        safeLog("teacher_assignment_mutation_denied", requestId, context);
        return Response.json({ error: "Not found" }, { status: 404 });
      case "INVALID_INPUT":
        return Response.json({ error: "Invalid request" }, { status: 400 });
      case "CONFLICT":
      case "INVALID_STATE":
        return Response.json({ error: "Conflict" }, { status: 409 });
      case "INTERNAL":
        safeLog("teacher_assignment_mutation_failed", requestId, context);
        return Response.json(
          { error: "Request could not be completed" },
          { status: 500 },
        );
    }
  }

  safeLog("teacher_assignment_mutation_failed", requestId, {
    ...context,
    errorType: error instanceof Error ? error.name : "unknown",
  });
  return Response.json(
    { error: "Request could not be completed" },
    { status: 500 },
  );
}

export async function handleTeacherAssignmentMutation<
  TBody extends Record<string, unknown>,
>({
  request,
  params,
  schema,
  operation,
  status = 200,
  mutate,
}: MutationOptions<TBody>) {
  const requestId = randomUUID();
  const logContext: SafeLogContext = { operation };
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const routeParams = await params;
    const validParams = z
      .object({
        schoolId: identifier,
        assignmentId: identifier.optional(),
      })
      .safeParse(routeParams);
    if (!validParams.success) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    const principal = await resolveSchoolPrincipal(
      session.user.id,
      validParams.data.schoolId,
    );
    const decision = authorize(principal, "school:configure", {
      schoolId: validParams.data.schoolId,
    });
    if (!decision.allowed) {
      safeLog("teacher_assignment_mutation_denied", requestId, logContext);
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const parsedBody = schema.safeParse(body);
    if (!parsedBody.success) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const assignment = await mutate({
      ...parsedBody.data,
      ...validParams.data,
    });
    return Response.json({ assignment }, { status });
  } catch (error) {
    return errorResponse(error, requestId, logContext);
  }
}
