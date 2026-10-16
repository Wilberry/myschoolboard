import { proposeFeeAdjustment, listFeeAdjustmentProposals } from "@/src/modules/fees/fee-adjustment-proposal-service";
import { FeeError } from "@/src/modules/fees/fee-configuration-service";
const headers = { "Cache-Control": "private, no-store" };
function failure(e: unknown) {
  const code = e instanceof SyntaxError ? "INVALID_INPUT"
    : e instanceof FeeError ? e.code : "INTERNAL";
  const status = code === "UNAUTHENTICATED" ? 401 : code === "INVALID_INPUT" ? 400
    : code === "NOT_FOUND" ? 404 : code === "CONFLICT" ? 409 : 500;
  return Response.json({ error: status === 401 ? "Unauthorized" : status === 400
    ? "Invalid request" : status === 404 ? "Not found" : status === 409
    ? "Conflict" : "Request failed" }, { status, headers });
}
export async function GET(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search) return Response.json({ error: "Invalid request" }, { status: 400, headers });
    const { schoolId } = await params;
    return Response.json({ proposals: await listFeeAdjustmentProposals(schoolId),
      status: "ADVISORY_PROPOSALS_NOT_EFFECTIVE" }, { headers });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return Response.json({ error: "Invalid request" }, { status: 400, headers });
    const { schoolId } = await params;
    const proposal = await proposeFeeAdjustment(schoolId, await request.json());
    return Response.json({ proposal }, { status: proposal.replay ? 200 : 201, headers });
  } catch (e) { return failure(e); }
}
