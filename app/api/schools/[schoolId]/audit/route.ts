import { readSchoolAudit } from "@/src/modules/audit/school-ledger";
import {
  noticeQuery,
  noticeFailure,
  noticeHeaders,
} from "@/src/modules/communications/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const query = noticeQuery(r, ["source", "cursor"]);
    const { schoolId } = await params;
    return Response.json(
      await readSchoolAudit(
        schoolId,
        query.get("source") ?? undefined,
        query.get("cursor") ?? undefined,
      ),
      { headers: noticeHeaders },
    );
  } catch (error) {
    return noticeFailure(error);
  }
}
