import { handleAttendanceCorrection } from "@/src/modules/attendance/corrections-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; requestId: string }> },
) {
  return handleAttendanceCorrection(request, params, "decision");
}
