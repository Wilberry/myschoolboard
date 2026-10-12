import { handleAttendanceRead } from "@/src/modules/attendance/read-http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleAttendanceRead(request, params, "roster");
}
