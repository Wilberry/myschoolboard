import { getFinanceWorkspace } from "@/src/modules/fees/finance-workspace-service";
import {
  financialHeaders,
  financialError,
} from "@/src/modules/fees/financial-http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search)
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: financialHeaders },
      );
    return Response.json(await getFinanceWorkspace((await params).schoolId), {
      headers: financialHeaders,
    });
  } catch (e) {
    return financialError(e);
  }
}
