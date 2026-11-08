-- A newly inserted membership cannot revoke an existing delivery: every
-- recipient, original teacher, assignment and verified relationship is bound
-- to an already-existing membership by foreign key. Rechecking all existing
-- deliveries on each new membership made bulk enrolment quadratic. Updates
-- (including identity/role/activity changes) and deletes retain the full scan.
DROP TRIGGER "Membership_module_suppression" ON "Membership";
CREATE TRIGGER "Membership_module_suppression" AFTER UPDATE OR DELETE ON "Membership" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
