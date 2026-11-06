import { handleCorrectionRead } from "@/src/modules/attendance/corrections-read-http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; registerId: string }> },
) {
  return handleCorrectionRead(request, params, "entries");
}
