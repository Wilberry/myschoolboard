import { handleCorrectionRead } from "@/src/modules/attendance/corrections-read-http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; requestId: string }> },
) {
  return handleCorrectionRead(request, params, "detail");
}
