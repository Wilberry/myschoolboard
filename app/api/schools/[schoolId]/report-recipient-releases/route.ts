import {
  releaseOfficialComposition, listReportRecipientReleases,
} from "@/src/modules/results/report-publication-service";
import {
  reportHeaders, reportHttpError, requireJsonPost,
  requireUnparameterizedGet,
} from "@/src/modules/results/report-http";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET(
  request: Request, { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    requireUnparameterizedGet(request);
    const { schoolId } = await params;
    return Response.json({
      releases: await listReportRecipientReleases(schoolId),
    }, { headers: reportHeaders });
  } catch (error) { return reportHttpError(error); }
}
export async function POST(
  request: Request, { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    requireJsonPost(request);
    const { schoolId } = await params;
    return Response.json({
      release: await releaseOfficialComposition(schoolId, await request.json()),
    }, { status: 201, headers: reportHeaders });
  } catch (error) { return reportHttpError(error); }
}
