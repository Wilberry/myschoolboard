-- Preserve the repository's explicit whole-school cleanup convention. Constraint
-- deferral still rejects dangling/cross-school references at transaction commit.
ALTER TABLE "Notice" ALTER CONSTRAINT "Notice_schoolId_authorMembershipId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "NoticeRelease" ALTER CONSTRAINT "NoticeRelease_schoolId_policyId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "NotificationDelivery" ALTER CONSTRAINT "NotificationDelivery_schoolId_recipientMembershipId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "NoticeRevision" ADD CONSTRAINT "NoticeRevision_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "NoticeWorkflowEvent" ADD CONSTRAINT "NoticeWorkflowEvent_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "NoticeRelease" ADD CONSTRAINT "NoticeRelease_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "NoticeWithdrawal" ADD CONSTRAINT "NoticeWithdrawal_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "OutboxDispatch" ADD CONSTRAINT "OutboxDispatch_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "OutboxAttemptEvent" ADD CONSTRAINT "OutboxAttemptEvent_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "NotificationInteraction" ADD CONSTRAINT "NotificationInteraction_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "NotificationSuppression" ADD CONSTRAINT "NotificationSuppression_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
ALTER TABLE "OutboxReplayEvent" ADD CONSTRAINT "OutboxReplayEvent_owning_school" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
