import { releaseFeeAccount } from "@/src/modules/fees/financial-account-service";
import {
  financialJson,
  financialHeaders,
  financialError,
} from "@/src/modules/fees/financial-http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    financialJson(request);
    const result = await releaseFeeAccount(
      (await params).schoolId,
      await request.json(),
    );
    return Response.json(
      { release: result },
      { status: result.replay ? 200 : 201, headers: financialHeaders },
    );
  } catch (e) {
    return financialError(e);
  }
}
