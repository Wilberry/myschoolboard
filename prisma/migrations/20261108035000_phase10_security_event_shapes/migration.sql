-- Prevent relabelling a fabricated session fact with an application method.
ALTER TABLE "AuthSecurityEvidence" ADD CONSTRAINT "AuthSecurityEvidence_method_kind" CHECK(
 ("kind" IN ('SESSION_CREATED','SESSION_CHANGED','SESSION_ENDED') AND "method"='DATABASE_SESSION' AND "actorUserId" IS NULL AND "sessionRecordId" IS NOT NULL)
 OR ("kind"='AUTH_SUCCEEDED' AND "method" IN ('EMAIL_SIGN_IN','EMAIL_SIGN_UP') AND "actorUserId" IS NOT NULL AND "actorUserId"="subjectUserId" AND "sessionRecordId" IS NOT NULL)
 OR ("kind"='AUTH_FAILED' AND "method" IN ('EMAIL_SIGN_IN','EMAIL_SIGN_UP','SIGN_OUT'))
 OR ("kind" IN ('LOGOUT_REQUESTED','LOGOUT_COMPLETED','LOGOUT_FAILED') AND "method"='SIGN_OUT' AND "actorUserId" IS NOT NULL AND "actorUserId"="subjectUserId" AND "sessionRecordId" IS NOT NULL)
);
