import {
  attestGuardianStudentLink,
  listGuardianStudentLinksForAdmin,
} from "@/src/modules/students/guardian-link-service";
import {
  guardianHeaders,
  guardianHttpError,
} from "@/src/modules/students/guardian-http";
import { AcademicConfigError } from "@/src/modules/academics/config-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** School-admin identity attestation only; NEVER guardian result access. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
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
    const { schoolId } = await params;
    return Response.json(
      {
        link: await attestGuardianStudentLink(schoolId, await request.json()),
        status: "GUARDIAN_LINK_EVIDENCE_ONLY_NO_REPORT_ACCESS",
      },
      { status: 201, headers: guardianHeaders },
    );
  } catch (error) {
    return guardianHttpError(error);
  }
}

/** Read only school admin's minimal audit history, never student marks. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search)
      return guardianHttpError(new AcademicConfigError("INVALID_INPUT"));
    const { schoolId } = await params;
    return Response.json(
      {
        links: await listGuardianStudentLinksForAdmin(schoolId),
        status: "GUARDIAN_LINK_EVIDENCE_ONLY_NO_REPORT_ACCESS",
      },
      { headers: guardianHeaders },
    );
  } catch (error) {
    return guardianHttpError(error);
  }
}
