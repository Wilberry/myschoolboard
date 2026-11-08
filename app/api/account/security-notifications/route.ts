import { securityInboxGET } from "@/src/modules/notifications/security-http";
export const GET = (request: Request) => securityInboxGET(request, "ACCOUNT");
