import {
  readPlatformTrash,
  changePlatformTrash,
} from "@/src/modules/trash/service";
import {
  trashHeaders,
  trashFailure,
  validateTrashRequest,
  readTrashMutation,
} from "@/src/modules/trash/http";
export async function GET(request: Request) {
  try {
    validateTrashRequest(request);
    return Response.json(await readPlatformTrash(), { headers: trashHeaders });
  } catch (e) {
    return trashFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    validateTrashRequest(request, true);
    const result = await changePlatformTrash(await readTrashMutation(request));
    return Response.json(
      { result },
      { status: result.replay ? 200 : 201, headers: trashHeaders },
    );
  } catch (e) {
    return trashFailure(e);
  }
}
