import {
  adoptSchoolReportAggregationRule, listOwnReportAggregationRules,
} from "@/src/modules/results/report-aggregation-rule-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** School-owner-only policy, not student grades or report release. */
export async function GET(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search)
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    const { schoolId } = await params;
    return Response.json({
      rules: await listOwnReportAggregationRules(schoolId),
      status: "PRIVATE_AGGREGATION_POLICY_NOT_APPLIED_TO_REPORTS",
    }, { headers: manualHeaders });
  } catch (error) { return manualError(error); }
}
export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    const { schoolId } = await params;
    return Response.json({
      rule: await adoptSchoolReportAggregationRule(schoolId, await request.json()),
      status: "AGGREGATION_RULE_ADOPTED_NOT_PUBLISHED",
    }, { status: 201, headers: manualHeaders });
  } catch (error) { return manualError(error); }
}
