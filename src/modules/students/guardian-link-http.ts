import { randomUUID } from "node:crypto";
import { AcademicConfigError } from "@/src/modules/academics/config-service";
import {
  attestGuardianStudentLink,
  listGuardianStudentLinksForAdmin,
  revokeGuardianStudentLink,
} from "./guardian-link-service";

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function failure(error: unknown) {
  if (error instanceof AcademicConfigError) {
    if (error.code === "UNAUTHENTICATED")
      return reply({ error: "Unauthorized" }, 401);
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
      return reply({ error: "Not found" }, 404);
    if (error.code === "INVALID_INPUT")
      return reply({ error: "Invalid request" }, 400);
    if (error.code === "CONFLICT")
      return reply({ error: "Conflict" }, 409);
  }
  if (error instanceof SyntaxError)
    return reply({ error: "Invalid request" }, 400);
  try {
    console.warn(JSON.stringify({
      event: "guardian_student_link_failed",
      requestId: randomUUID(),
    }));
  } catch {
    // Never log child identifiers, guardian details, cookies or personal data.
  }
  return reply({ error: "Request could not be completed" }, 500);
}

export async function handleGuardianLink(
  request: Request,
  params: Promise<{ schoolId: string; linkId?: string }>,
  action: "attest" | "list" | "revoke",
): Promise<Response> {
  try {
    if (new URL(request.url).search)
      return reply({ error: "Invalid request" }, 400);
    const { schoolId, linkId } = await params;
    if (action === "list")
      return reply({ links: await listGuardianStudentLinksForAdmin(schoolId) });
    if (action === "attest")
      return reply({
        link: await attestGuardianStudentLink(schoolId, await request.json()),
      }, 201);
    if (!linkId) return reply({ error: "Invalid request" }, 400);
    return reply({
      revocation: await revokeGuardianStudentLink(
        schoolId,
        linkId,
        await request.json(),
      ),
    }, 201);
  } catch (error) {
    return failure(error);
  }
}
