import { handleStudentMutation } from "@/src/modules/students/http";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      schoolId: string;
      studentId: string;
      enrollmentId: string;
    }>;
  },
) {
  return handleStudentMutation(request, params, "withdraw");
}
