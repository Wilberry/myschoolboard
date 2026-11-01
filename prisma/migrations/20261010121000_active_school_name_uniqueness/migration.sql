-- The active records in the local development database were checked for collisions
-- using lower(btrim(name)); no duplicates existed before this migration.
-- Normalize by case-folding and trimming surrounding ASCII spaces. Internal
-- whitespace is significant. Inactive records do not reserve a name.
CREATE UNIQUE INDEX "SchoolClass_schoolId_normalized_active_name_key"
ON "SchoolClass" ("schoolId", lower(btrim("name")))
WHERE "isActive" = true;

CREATE UNIQUE INDEX "Subject_schoolId_normalized_active_name_key"
ON "Subject" ("schoolId", lower(btrim("name")))
WHERE "isActive" = true;
