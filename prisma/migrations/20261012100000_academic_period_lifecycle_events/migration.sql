-- Extend the existing append-only school configuration ledger with
-- auditable academic session/term activation and closure events.
-- This does not alter historical teacher assignments or period dates.
ALTER TYPE "SchoolConfigurationEventType"
  ADD VALUE 'ACADEMIC_SESSION_ACTIVATED';
ALTER TYPE "SchoolConfigurationEventType"
  ADD VALUE 'ACADEMIC_SESSION_CLOSED';
ALTER TYPE "SchoolConfigurationEventType"
  ADD VALUE 'ACADEMIC_TERM_ACTIVATED';
ALTER TYPE "SchoolConfigurationEventType"
  ADD VALUE 'ACADEMIC_TERM_CLOSED';

-- Persist the operator's justification for academic status transitions.
-- Earlier configuration creation events remain valid with NULL reason.
ALTER TABLE "SchoolConfigurationEvent" ADD COLUMN "reason" TEXT;
