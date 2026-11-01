import { handleAttendanceCorrection } from "@/src/modules/attendance/corrections-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; registerId: string }> },
) {
  return handleAttendanceCorrection(request, params, "request");
}
