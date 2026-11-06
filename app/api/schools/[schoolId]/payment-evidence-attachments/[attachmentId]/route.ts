import { readPaymentImage } from "@/src/modules/fees/payment-attachment-service";
import { FeeError } from "@/src/modules/fees/fee-configuration-service";
import {
  financialHeaders,
  financialError,
} from "@/src/modules/fees/financial-http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; attachmentId: string }> },
) {
  try {
    if (new URL(request.url).search) throw new FeeError("INVALID_INPUT");
    const { schoolId, attachmentId } = await params;
    return new Response(await readPaymentImage(schoolId, attachmentId), {
      headers: {
        ...financialHeaders,
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="payment-evidence.png"',
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return financialError(e);
  }
}
