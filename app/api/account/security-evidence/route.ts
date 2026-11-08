import { authenticationEvidenceGET } from "@/src/modules/audit/auth-security-reader";
export const GET = (request: Request) =>
  authenticationEvidenceGET(request, "SELF");
