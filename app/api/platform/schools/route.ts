import { handleSchoolOnboarding } from "@/src/modules/platform/school-lifecycle-http";

export async function POST(request: Request) {
  return handleSchoolOnboarding(request);
}
