export function mayTransitionPeriod(
  previous: "PLANNED" | "ACTIVE" | "CLOSED",
  next: "ACTIVE" | "CLOSED",
): boolean {
  return (
    (previous === "PLANNED" && next === "ACTIVE") ||
    (previous === "ACTIVE" && next === "CLOSED")
  );
}
