import {
  handleSchoolSubscriptionStatusGet,
} from "@/src/modules/platform/subscription-http";

type Context = { params: Promise<{ schoolId: string }> };

export async function GET(_request: Request, { params }: Context) {
  return handleSchoolSubscriptionStatusGet(params);
}
