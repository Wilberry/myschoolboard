import { readInternalTeacherResultPreparation } from "@/src/modules/results/preparation-service";
import {
  manualError,
  manualHeaders,
} from "@/src/modules/assessments/manual-http";

/** Phase 8 private teacher preview only. No publication or report downloads. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const q = new URL(request.url).searchParams;
    const expected = ["classId", "sessionId", "termId", "subjectId"];
    if (
      q.size !== 4 ||
      Array.from(q.keys()).some((k) => !expected.includes(k))
    ) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const [classId, sessionId, termId, subjectId] = expected.map(
      (key) => q.get(key) ?? "",
    );
    const { schoolId } = await params;
    const preparation = await readInternalTeacherResultPreparation(
      schoolId,
      sessionId,
      termId,
      classId,
      subjectId,
    );
    return Response.json({ preparation }, { headers: manualHeaders });
  } catch (error) {
    return manualError(error);
  }
}
