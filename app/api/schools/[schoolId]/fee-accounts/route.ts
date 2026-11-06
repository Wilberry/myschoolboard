import { readFinancialAccounts } from "@/src/modules/fees/financial-account-service";
import {
  financialQuery,
  financialHeaders,
  financialError,
} from "@/src/modules/fees/financial-http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    return Response.json(
      {
        accounts: await readFinancialAccounts(
          (await params).schoolId,
          financialQuery(request, "obligationId"),
        ),
        provenance: "SCHOOL_MANUAL_ACCOUNTING_LEDGER",
      },
      { headers: financialHeaders },
    );
  } catch (e) {
    return financialError(e);
  }
}
