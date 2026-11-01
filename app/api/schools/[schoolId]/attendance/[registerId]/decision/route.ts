import { handleAttendancePost } from "@/src/modules/attendance/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; registerId: string }> },
) {
  return handleAttendancePost(request, params, "decide");
}
