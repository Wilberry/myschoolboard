const actorKeys = new Set([
  "adminA",
  "superA",
  "teacherA",
  "headA",
  "principalA",
  "studentA",
  "unlinkedA",
  "parentA",
  "adminB",
  "outsider",
]);
const runIdPattern = /^[a-z][a-z0-9-]{5,25}$/;

/** Better Auth stores normalized lowercase emails; preserve logical actor keys. */
export function browserFixtureEmail(runId, actorKey) {
  if (!runIdPattern.test(runId) || !actorKeys.has(actorKey)) {
    throw new Error("Invalid synthetic browser fixture identity");
  }
  return `${runId}-${actorKey.toLowerCase()}@myschoolboard.test`;
}
