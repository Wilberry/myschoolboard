import { securityWrite } from "@/src/modules/notifications/security-http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ deliveryId: string }> },
) {
  return securityWrite(request, "STATE", "PLATFORM", (await params).deliveryId);
}
