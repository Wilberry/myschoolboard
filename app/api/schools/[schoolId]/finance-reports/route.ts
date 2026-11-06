import { readFinanceReports } from "@/src/modules/fees/financial-account-service";
import {
  financialHeaders,
  financialError,
} from "@/src/modules/fees/financial-http";
import { safeCsvCell } from "@/src/modules/fees/money-display";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const url = new URL(request.url);
    if (
      [...url.searchParams.keys()].some((k) => k !== "format") ||
      url.searchParams.getAll("format").length > 1 ||
      (url.searchParams.has("format") &&
        url.searchParams.get("format") !== "csv")
    )
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: financialHeaders },
      );
    const reports = await readFinanceReports((await params).schoolId);
    if (url.searchParams.get("format") === "csv") {
      const rows = [
        [
          "Currency",
          "Session",
          "Term",
          "Obligations",
          "Charges (minor units)",
          "Waivers",
          "Net allocations",
          "Reversed allocations",
          "Balance",
        ],
        ...reports.map((r) => [
          r.currency,
          r.sessionName,
          r.termName,
          r.obligations,
          r.originalChargeMinor,
          r.waivedMinor,
          r.allocatedMinor,
          r.reversedMinor,
          r.remainingMinor,
        ]),
      ];
      return new Response(
        rows.map((row) => row.map(safeCsvCell).join(",")).join("\r\n"),
        {
          headers: {
            ...financialHeaders,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="school-finance-report.csv"',
          },
        },
      );
    }
    return Response.json(
      { reports, provenance: "SCHOOL_MANUAL_ACCOUNTING_LEDGER" },
      { headers: financialHeaders },
    );
  } catch (e) {
    return financialError(e);
  }
}
