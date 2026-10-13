import {
  adoptSchoolReportVisibilityPolicy,
  listSchoolReportVisibilityPolicies,
} from "@/src/modules/results/report-visibility-policy-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** Only the verified school owner can read FUTURE visibility configuration.
 * This endpoint returns no student record, grade, report or release token.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json(
      {
        policies: await listSchoolReportVisibilityPolicies(schoolId),
        status: "CONFIGURATION_ONLY_NO_REPORT_RECIPIENT_ACCESS",
      },
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

/** An adopted mode is NOT final publication approval or an access grant. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (
      new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")
    ) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json(
      {
        policy: await adoptSchoolReportVisibilityPolicy(
          schoolId,
          await request.json(),
        ),
        status: "VISIBILITY_POLICY_ADOPTED_REPORTS_NOT_RELEASED",
      },
      { status: 201, headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}
