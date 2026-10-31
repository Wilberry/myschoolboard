import {
  handlePlatformPlansGet,
  handlePlatformPlansPost,
} from "@/src/modules/platform/subscription-http";

export async function GET() {
  return handlePlatformPlansGet();
}

export async function POST(request: Request) {
  return handlePlatformPlansPost(request);
}
