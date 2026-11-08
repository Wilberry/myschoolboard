import { createCatalogEntry } from "@/src/modules/learning-resources/catalog";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const { schoolId } = await params;
    return noticeResult(
      await createCatalogEntry(schoolId, await noticeJson(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

import { readLibraryCatalog } from "@/src/modules/learning-resources/catalog";
import { noticeQuery, noticeHeaders } from "@/src/modules/communications/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const q = noticeQuery(r, ["releaseId"]);
    return Response.json(
      await readLibraryCatalog(
        (await params).schoolId,
        q.get("releaseId") ?? undefined,
      ),
      { headers: noticeHeaders },
    );
  } catch (e) {
    return noticeFailure(e);
  }
}
