import { issueFeeReceipt } from "@/src/modules/fees/financial-account-service";
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
    const result = await issueFeeReceipt(
      (await params).schoolId,
      await request.json(),
    );
    return Response.json(
      { receipt: result },
      { status: result.replay ? 200 : 201, headers: financialHeaders },
    );
  } catch (e) {
    return financialError(e);
  }
}

import { readFinancialReceipts } from "@/src/modules/fees/financial-account-service";
import { financialQuery } from "@/src/modules/fees/financial-http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    return Response.json(
      {
        receipts: await readFinancialReceipts(
          (await params).schoolId,
          financialQuery(request, "receiptId"),
        ),
        provenance: "INDEPENDENTLY_REVIEWED_MANUAL_ALLOCATION",
      },
      { headers: financialHeaders },
    );
  } catch (e) {
    return financialError(e);
  }
}
