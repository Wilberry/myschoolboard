import {
  inspectPrivateClassTermSubjectCoverage,
} from "@/src/modules/results/private-subject-coverage-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** Private school-owner metadata only: no pupil names, scores, reports or
 * publication decision. An observed composition is NOT release readiness.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const target = new URL(request.url);
    const keys = ["sessionId", "termId", "classId"];
    if (
      [...target.searchParams.keys()].length !== keys.length ||
      keys.some((key) => target.searchParams.getAll(key).length !== 1) ||
      [...target.searchParams.keys()].some((key) => !keys.includes(key))
    ) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json(
      await inspectPrivateClassTermSubjectCoverage(schoolId, {
        sessionId: target.searchParams.get("sessionId"),
        termId: target.searchParams.get("termId"),
        classId: target.searchParams.get("classId"),
      }),
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}
