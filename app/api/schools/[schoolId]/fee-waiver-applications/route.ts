import {
  applyApprovedFeeWaiver, listAppliedFeeWaivers,
} from "@/src/modules/fees/effective-fee-waiver-service";
import { FeeError } from "@/src/modules/fees/fee-configuration-service";

const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const code = error instanceof SyntaxError ? "INVALID_INPUT"
    : error instanceof FeeError ? error.code : "INTERNAL";
  const status = code === "UNAUTHENTICATED" ? 401
    : code === "INVALID_INPUT" ? 400
    : code === "NOT_FOUND" ? 404
    : code === "CONFLICT" ? 409 : 500;
  return Response.json({ error: status === 401 ? "Unauthorized"
    : status === 400 ? "Invalid request"
    : status === 404 ? "Not found"
    : status === 409 ? "Conflict" : "Request failed" }, { status, headers });
}

/** Only current same-school School Super Admin; never student/guardian.
 * An INTERNAL applied waiver is NOT proof of payment or receipt. */
export async function GET(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search) return Response.json(
      { error: "Invalid request" }, { status: 400, headers });
    const { schoolId } = await params;
    return Response.json({
      waivers: await listAppliedFeeWaivers(schoolId),
      status: "INTERNAL_WAIVER_APPLICATIONS_NOT_SETTLEMENT",
    }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return Response.json({ error: "Invalid request" }, { status: 400, headers });
    const { schoolId } = await params;
    const waiver = await applyApprovedFeeWaiver(schoolId, await request.json());
    return Response.json({ waiver }, {
      status: waiver.replay ? 200 : 201, headers,
    });
  } catch (error) { return failure(error); }
}
