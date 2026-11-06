import {
  handleSchoolSubscriptionsGet,
  handleSchoolSubscriptionsPost,
} from "@/src/modules/platform/subscription-http";

type Context = { params: Promise<{ schoolId: string }> };

export async function GET(_request: Request, { params }: Context) {
  return handleSchoolSubscriptionsGet(params);
}

export async function POST(request: Request, { params }: Context) {
  return handleSchoolSubscriptionsPost(request, params);
}
