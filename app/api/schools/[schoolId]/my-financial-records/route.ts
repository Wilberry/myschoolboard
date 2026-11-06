import {
  readFinancialAccounts,
  readFinancialReceipts,
  requireFinancialReads,
} from "@/src/modules/fees/financial-account-service";
import {
  currentUserId,
  FeeError,
} from "@/src/modules/fees/fee-configuration-service";
import { prisma } from "@/src/lib/db";
import {
  financialHeaders,
  financialError,
} from "@/src/modules/fees/financial-http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    requireFinancialReads();
    if (new URL(request.url).search) throw new FeeError("INVALID_INPUT");
    const { schoolId } = await params;
    const userId = await currentUserId();
    const recipient = await prisma.membership.findFirst({
      where: {
        schoolId,
        userId,
        isActive: true,
        role: { in: ["STUDENT", "PARENT"] },
        school: { isActive: true },
      },
      select: { id: true },
    });
    if (!recipient) throw new FeeError("NOT_FOUND");
    const [accounts, receipts] = await Promise.all([
      readFinancialAccounts(schoolId),
      readFinancialReceipts(schoolId),
    ]);
    return Response.json(
      { accounts, receipts, provenance: "SCHOOL_MANUAL_ACCOUNTING_LEDGER" },
      { headers: financialHeaders },
    );
  } catch (e) {
    return financialError(e);
  }
}
