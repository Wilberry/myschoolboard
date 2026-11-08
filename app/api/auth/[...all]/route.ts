import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/src/lib/auth";

import { auditedAuthenticationHTTP } from "@/src/lib/auth-security-http";
const handlers = toNextJsHandler(auth);
export const GET = (request: Request) =>
  auditedAuthenticationHTTP(request, handlers.GET);
export const POST = (request: Request) =>
  auditedAuthenticationHTTP(request, handlers.POST);
