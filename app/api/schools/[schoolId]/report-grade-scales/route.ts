import {
  adoptSchoolReportGradeScale, listOwnReportGradeScales,
} from "@/src/modules/results/report-grade-scale-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** School-owner private policy history; not student or public report output. */
export async function GET(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search)
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    const { schoolId } = await params;
    return Response.json({ scales: await listOwnReportGradeScales(schoolId),
      status: "ADOPTED_GRADING_SCALE_NOT_APPLIED_TO_REPORTS" },
    { headers: manualHeaders });
  } catch (error) { return manualError(error); }
}

/** Explicit owner adoption only. Never grades, releases or exports reports. */
export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    const { schoolId } = await params;
    return Response.json({
      scale: await adoptSchoolReportGradeScale(schoolId, await request.json()),
      status: "SCHOOL_GRADE_SCALE_ADOPTED_NOT_PUBLISHED",
    }, { status: 201, headers: manualHeaders });
  } catch (error) { return manualError(error); }
}
