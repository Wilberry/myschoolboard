import { handleAttendanceRead } from "@/src/modules/attendance/read-http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; registerId: string }> },
) {
  return handleAttendanceRead(request, params, "review-detail");
}
