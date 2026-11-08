import {
  readSchoolTrash,
  changeSchoolTrash,
} from "@/src/modules/trash/service";
import {
  trashHeaders,
  trashFailure,
  validateTrashRequest,
  readTrashMutation,
} from "@/src/modules/trash/http";
type Context = { params: Promise<{ schoolId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    validateTrashRequest(request);
    return Response.json(await readSchoolTrash((await params).schoolId), {
      headers: trashHeaders,
    });
  } catch (e) {
    return trashFailure(e);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    validateTrashRequest(request, true);
    const result = await changeSchoolTrash(
      (await params).schoolId,
      await readTrashMutation(request),
    );
    return Response.json(
      { result },
      { status: result.replay ? 200 : 201, headers: trashHeaders },
    );
  } catch (e) {
    return trashFailure(e);
  }
}
