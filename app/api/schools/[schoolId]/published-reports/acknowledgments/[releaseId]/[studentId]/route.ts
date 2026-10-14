import { acknowledgeGuardianReport } from "@/src/modules/results/recipient-report-service";
import {
  reportHeaders,
  reportHttpError,
  requireJsonPost,
} from "@/src/modules/results/report-http";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Exact-child, exact-release PARENT acknowledgment; never self-attested. */
export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      schoolId: string;
      releaseId: string;
      studentId: string;
    }>;
  },
) {
  try {
    requireJsonPost(request);
    const { schoolId, releaseId, studentId } = await params;
    return Response.json(
      {
        receipt: await acknowledgeGuardianReport(
          schoolId,
          releaseId,
          studentId,
          await request.json(),
        ),
      },
      { status: 201, headers: reportHeaders },
    );
  } catch (error) {
    return reportHttpError(error);
  }
}
