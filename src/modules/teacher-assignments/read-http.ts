import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";
import {
  getAdminAssignment,
  listAdminAssignments,
  type AssignmentReader,
} from "./read-service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value === value.trim());

const routeParams = z
  .object({ schoolId: id, assignmentId: id.optional() })
  .strict();

function respond(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function safeReadLog(event: string): void {
  try {
    console.warn(JSON.stringify({ event, requestId: randomUUID() }));
  } catch {
    // Diagnostics must never change a denied response.
  }
}

interface ReadOptions {
  request: Request;
  params: Promise<{ schoolId: string; assignmentId?: string }>;
  operation: "list" | "detail";
}

export async function handleTeacherAssignmentRead({
  request,
  params,
  operation,
}: ReadOptions): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return respond({ error: "Unauthorized" }, 401);

    const path = routeParams.safeParse(await params);
    if (
      !path.success ||
      (operation === "detail" && !path.data.assignmentId) ||
      (operation === "list" && path.data.assignmentId)
    ) {
      return respond({ error: "Invalid request" }, 400);
    }

    const principal = await resolveSchoolPrincipal(
      session.user.id,
      path.data.schoolId,
    );
    const decision = authorize(principal, "school:configure", {
      schoolId: path.data.schoolId,
    });
    if (!decision.allowed || !principal?.membership) {
      safeReadLog("teacher_assignment_read_denied");
      return respond({ error: "Not found" }, 404);
    }

    const role = principal.membership.role;
    if (role !== "SCHOOL_ADMIN" && role !== "SCHOOL_SUPER_ADMIN") {
      safeReadLog("teacher_assignment_read_denied");
      return respond({ error: "Not found" }, 404);
    }
    const reader: AssignmentReader = {
      userId: session.user.id,
      schoolId: path.data.schoolId,
      role,
    };
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some((key) => key !== "cursor")) {
      return respond({ error: "Invalid request" }, 400);
    }
    if (operation === "detail" && url.search) {
      return respond({ error: "Invalid request" }, 400);
    }
    if (url.searchParams.getAll("cursor").length > 1) {
      return respond({ error: "Invalid request" }, 400);
    }
    const cursor = url.searchParams.get("cursor");
    if (cursor !== null && !id.safeParse(cursor).success) {
      return respond({ error: "Invalid request" }, 400);
    }

    if (operation === "list") {
      const page = await listAdminAssignments(reader, cursor ?? undefined);
      if (!page) {
        safeReadLog("teacher_assignment_read_denied");
        return respond({ error: "Not found" }, 404);
      }
      return respond(page);
    }

    const assignment = await getAdminAssignment(
      reader,
      path.data.assignmentId!,
    );
    if (!assignment) {
      safeReadLog("teacher_assignment_read_denied");
      return respond({ error: "Not found" }, 404);
    }
    return respond({ assignment });
  } catch {
    safeReadLog("teacher_assignment_read_failed");
    return respond({ error: "Request could not be completed" }, 500);
  }
}
