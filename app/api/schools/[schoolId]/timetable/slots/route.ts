import { handleTimetableWrite } from "@/src/modules/timetable/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleTimetableWrite(request, params, "slot");
}
