import { readLearningAssignments } from "@/src/modules/learning-assignments/service";
import {
  noticeQuery,
  noticeHeaders,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const q = noticeQuery(r, ["releaseId"]);
    const { schoolId } = await params;
    const result = await readLearningAssignments(
      schoolId,
      q.get("releaseId") ?? undefined,
    );
    return Response.json(result, { headers: noticeHeaders });
  } catch (e) {
    return noticeFailure(e);
  }
}
