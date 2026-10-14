import {
  adoptReportVisibilityPolicy,
  listReportVisibilityPolicies,
} from "@/src/modules/results/report-publication-service";
import {
  reportHeaders,
  reportHttpError,
  requireJsonPost,
  requireUnparameterizedGet,
} from "@/src/modules/results/report-http";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    requireUnparameterizedGet(request);
    const { schoolId } = await params;
    return Response.json(
      {
        policies: await listReportVisibilityPolicies(schoolId),
      },
      { headers: reportHeaders },
    );
  } catch (error) {
    return reportHttpError(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    requireJsonPost(request);
    const { schoolId } = await params;
    return Response.json(
      {
        policy: await adoptReportVisibilityPolicy(
          schoolId,
          await request.json(),
        ),
      },
      { status: 201, headers: reportHeaders },
    );
  } catch (error) {
    return reportHttpError(error);
  }
}
