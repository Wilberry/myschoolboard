import {
  decideInternalPaymentReference,
} from "@/src/modules/fees/payment-reference-service";
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
/** Deliberately no GET or bulk review: school-owner queue uses the
 * metadata-only /payment-evidence GET, and decisions are one-time POST. */
export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers });
    }
    const { schoolId } = await params;
    const decision = await decideInternalPaymentReference(schoolId, await request.json());
    return Response.json({ decision }, { status: decision.replay ? 200 : 201, headers });
  } catch (error) { return failure(error); }
}
