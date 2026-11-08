import { submitLearningWork } from "@/src/modules/learning-assignments/submissions";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; releaseId: string }> },
) {
  try {
    const { schoolId, releaseId } = await params;
    const result = await submitLearningWork(
      schoolId,
      releaseId,
      await noticeJson(r),
    );
    return noticeResult(result);
  } catch (e) {
    return noticeFailure(e);
  }
}

import { readLearningSubmissions } from "@/src/modules/learning-assignments/submissions";
import { noticeQuery, noticeHeaders } from "@/src/modules/communications/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; releaseId: string }> },
) {
  try {
    const q = noticeQuery(r, ["cursor"]);
    const { schoolId, releaseId } = await params;
    return Response.json(
      await readLearningSubmissions(
        schoolId,
        releaseId,
        q.get("cursor") ?? undefined,
      ),
      {
        headers: noticeHeaders,
      },
    );
  } catch (e) {
    return noticeFailure(e);
  }
}
