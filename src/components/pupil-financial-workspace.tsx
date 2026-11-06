"use client";
import { usePrivateFinance } from "./use-private-finance";
import { FinancialRecords } from "./financial-records";
import type {
  FinancialAccount,
  FinancialReceipt,
} from "@/src/modules/fees/financial-account-service";
export function PupilFinancialWorkspace({ schoolId }: { schoolId: string }) {
  const { view, message, panel, load, print } = usePrivateFinance<{
    accounts: FinancialAccount[];
    receipts: FinancialReceipt[];
  }>(`/api/schools/${encodeURIComponent(schoolId)}/my-financial-records`);
  return (
    <section
      className="financial-workspace"
      aria-label="Released financial records"
    >
      <div className="finance-controls finance-toolbar">
        <button onClick={() => void load()}>Recheck access</button>
        <button onClick={() => void print()}>Print records</button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div ref={panel} hidden={!view}>
        {view && (
          <FinancialRecords accounts={view.accounts} receipts={view.receipts} />
        )}
      </div>
    </section>
  );
}
