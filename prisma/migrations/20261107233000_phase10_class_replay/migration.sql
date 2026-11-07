ALTER TABLE "ClassOutboxAttempt" ADD COLUMN "requestKey" UUID;
CREATE UNIQUE INDEX "ClassOutboxAttempt_schoolId_requestKey_key" ON "ClassOutboxAttempt"("schoolId","requestKey");
ALTER TABLE "ClassOutboxAttempt" ADD CONSTRAINT "ClassOutboxAttempt_replay_key" CHECK(("outcome"='REPLAY')=("requestKey" IS NOT NULL));
