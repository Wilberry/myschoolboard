/** Pure school-adopted REPORT grade scale. No defaults and no report release.
 * Scores are INTEGER basis points (0..10000). School policy controls both
 * display rounding and whether grade labels use raw or rounded scores.
 * This function is NOT an official grade publication operation.
 */
export type GradeRoundingMode = "HALF_UP" | "FLOOR" | "CEILING";
export type GradeBandBasis = "RAW_BPS" | "DISPLAY_ROUNDED_BPS";
export interface ReportGradeBand {
  code: string;
  remark: string;
  minBps: number;
  maxBps: number;
}
export interface ReportGradeScalePolicy {
  decimalPlaces: 0 | 1 | 2;
  roundingMode: GradeRoundingMode;
  bandBasis: GradeBandBasis;
  bands: ReportGradeBand[];
}
export interface GradeScaleSimulation {
  status: "PRIVATE_POLICY_SIMULATION_ONLY";
  rawPercentBps: number;
  displayPercent: string;
  gradeCode: string;
  remark: string;
  bandBasis: GradeBandBasis;
}
const control = /[\u0000-\u001f\u007f-\u009f]/u;
const allowedKeys = ["code", "maxBps", "minBps", "remark"];
export function validateReportGradeScale(
  value: unknown,
): value is ReportGradeScalePolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Partial<ReportGradeScalePolicy>;
  if (
    ![0, 1, 2].includes(p.decimalPlaces as number) ||
    !["HALF_UP", "FLOOR", "CEILING"].includes(p.roundingMode as string) ||
    !["RAW_BPS", "DISPLAY_ROUNDED_BPS"].includes(p.bandBasis as string) ||
    !Array.isArray(p.bands) ||
    p.bands.length < 1 ||
    p.bands.length > 20
  )
    return false;
  const used = new Set<string>();
  let previousMax = -1;
  for (const item of p.bands) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const b = item as ReportGradeBand;
    if (
      JSON.stringify(Object.keys(b).sort()) !== JSON.stringify(allowedKeys) ||
      typeof b.code !== "string" ||
      typeof b.remark !== "string" ||
      b.code.trim() !== b.code ||
      b.remark.trim() !== b.remark ||
      b.code.length < 1 ||
      b.code.length > 16 ||
      b.remark.length < 1 ||
      b.remark.length > 120 ||
      control.test(b.code) ||
      control.test(b.remark) ||
      !Number.isInteger(b.minBps) ||
      !Number.isInteger(b.maxBps) ||
      b.minBps !== previousMax + 1 ||
      b.maxBps < b.minBps ||
      b.maxBps > 10000 ||
      used.has(b.code.toLowerCase())
    )
      return false;
    used.add(b.code.toLowerCase());
    previousMax = b.maxBps;
  }
  return previousMax === 10000;
}
export function simulateSchoolGradeScale(
  policy: ReportGradeScalePolicy,
  rawPercentBps: number,
): GradeScaleSimulation {
  if (
    !validateReportGradeScale(policy) ||
    !Number.isInteger(rawPercentBps) ||
    rawPercentBps < 0 ||
    rawPercentBps > 10000
  )
    throw new Error("Invalid school grading scale or score");
  const increment = 10 ** (2 - policy.decimalPlaces);
  const quotient = rawPercentBps / increment;
  const rounded =
    (policy.roundingMode === "FLOOR"
      ? Math.floor(quotient)
      : policy.roundingMode === "CEILING"
        ? Math.ceil(quotient)
        : Math.floor(quotient + 0.5)) * increment;
  const basis = policy.bandBasis === "RAW_BPS" ? rawPercentBps : rounded;
  const band = policy.bands.find((x) => basis >= x.minBps && basis <= x.maxBps);
  if (!band) throw new Error("No matching adopted grade band");
  const displayPercent = (rounded / 100).toFixed(policy.decimalPlaces);
  return {
    status: "PRIVATE_POLICY_SIMULATION_ONLY",
    rawPercentBps,
    displayPercent,
    gradeCode: band.code,
    remark: band.remark,
    bandBasis: policy.bandBasis,
  };
}
