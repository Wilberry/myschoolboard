import { securityWrite } from "@/src/modules/notifications/security-http";
export const POST = (request: Request) => securityWrite(request, "REPLAY");
