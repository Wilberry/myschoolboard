import { handleAttendancePost } from "@/src/modules/attendance/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleAttendancePost(request, params, "submit");
}
