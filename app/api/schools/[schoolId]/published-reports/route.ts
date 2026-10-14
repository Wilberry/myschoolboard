import { readCurrentPublishedReports } from "@/src/modules/results/recipient-report-service";
import {
  reportHeaders,
  reportHttpError,
  requireUnparameterizedGet,
} from "@/src/modules/results/report-http";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Authenticated pupil/guardian only, current exactly attested child, released subjects only. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    requireUnparameterizedGet(request);
    const { schoolId } = await params;
    return Response.json(await readCurrentPublishedReports(schoolId), {
      headers: reportHeaders,
    });
  } catch (error) {
    return reportHttpError(error);
  }
}
