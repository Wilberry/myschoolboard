import { revokeGuardianStudentLink } from "@/src/modules/students/guardian-link-service";
import {
  guardianHeaders,
  guardianHttpError,
} from "@/src/modules/students/guardian-http";
import { AcademicConfigError } from "@/src/modules/academics/config-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Audited terminal guardian link revocation. Not a result release. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; linkId: string }> },
) {
  try {
    if (
      new URL(request.url).search ||
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return guardianHttpError(new AcademicConfigError("INVALID_INPUT"));
    const { schoolId, linkId } = await params;
    return Response.json(
      {
        revocation: await revokeGuardianStudentLink(
          schoolId,
          linkId,
          await request.json(),
        ),
        status: "GUARDIAN_LINK_REVOKED_NO_REPORT_ACCESS",
      },
      { status: 201, headers: guardianHeaders },
    );
  } catch (error) {
    return guardianHttpError(error);
  }
}
