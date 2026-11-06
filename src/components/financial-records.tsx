"use client";
import type {
  FinancialAccount,
  FinancialReceipt,
} from "@/src/modules/fees/financial-account-service";
import { formatMinorAmount } from "@/src/modules/fees/money-display";
export function FinancialRecords({
  accounts,
  receipts,
}: {
  accounts: FinancialAccount[];
  receipts: FinancialReceipt[];
}) {
  return (
    <>
      <h2>School fee accounts</h2>
      <p>
        Balances include issued charges, applied fee waivers and payments
        independently reviewed and allocated by your school. A submitted payment
        claim does not reduce the balance.
      </p>
      {accounts.length ? (
        <div
          className="finance-table"
          role="region"
          aria-label="Scrollable fee account balances"
          tabIndex={0}
        >
          <table>
            <caption>Current school accounting balances</caption>
            <thead>
              <tr>
                <th scope="col">Pupil and fee</th>
                <th scope="col">Charge</th>
                <th scope="col">Waived</th>
                <th scope="col">Allocated</th>
                <th scope="col">Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.obligationId}>
                  <th scope="row">
                    {a.givenName} {a.familyName}
                    <br />
                    {a.categoryName}
                    <br />
                    {a.sessionName} · {a.termName}
                  </th>
                  <td>
                    {formatMinorAmount(a.originalChargeMinor, a.currency)}
                  </td>
                  <td>{formatMinorAmount(a.waivedMinor, a.currency)}</td>
                  <td>
                    {formatMinorAmount(a.allocatedMinor, a.currency)}
                    {a.reversedMinor !== "0" && (
                      <small>
                        {" "}
                        Reversed:{" "}
                        {formatMinorAmount(a.reversedMinor, a.currency)}
                      </small>
                    )}
                  </td>
                  <td>{formatMinorAmount(a.remainingMinor, a.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          No fee accounts are currently available under your school’s visibility
          policy.
        </p>
      )}
      <h2>Approved receipts</h2>
      {receipts.length ? (
        receipts.map((r) => (
          <article
            className="report-card finance-receipt"
            key={r.id}
            aria-label={`Receipt ${r.receiptNumber}`}
          >
            <h3>Receipt {r.receiptNumber}</h3>
            <p>{r.schoolName}</p>
            <p>
              {r.givenName} {r.familyName} · {r.categoryName}
            </p>
            <p>
              {r.sessionName} · {r.termName}
            </p>
            <p>
              <strong>{formatMinorAmount(r.amountMinor, r.currency)}</strong>
            </p>
            <p>
              {r.status === "REVERSED_MANUAL_ALLOCATION_RECEIPT"
                ? "Reversed allocation — excluded from the current balance."
                : "School-approved acknowledgment of an independently reviewed manual payment allocation."}
            </p>
            <p>
              Issued {new Date(r.issuedAt).toLocaleDateString("en-NG")}. This
              school receipt does not certify payment-provider settlement or a
              bank refund.
            </p>
          </article>
        ))
      ) : (
        <p>No approved receipts are available.</p>
      )}
    </>
  );
}
