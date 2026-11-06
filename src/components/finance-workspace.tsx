"use client";
import { PaymentImageForm } from "./payment-image-form";
import { usePrivateFinance } from "./use-private-finance";
import { FinancialRecords } from "./financial-records";
import {
  FinanceOperationForm,
  type FinanceField,
} from "./finance-operation-form";
import type { FinanceWorkspace } from "@/src/modules/fees/finance-workspace-service";
import {
  formatMinorAmount,
  parseMoneyAmount,
} from "@/src/modules/fees/money-display";
export function SchoolFinanceWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const { view, message, panel, load, print } =
    usePrivateFinance<FinanceWorkspace>(`${root}/finance-workspace`);
  const data = view;
  const saved = () => {
    void load();
  };
  const field = (name: string, label: string): FinanceField => ({
    name,
    label,
  });
  const select = (
    name: string,
    label: string,
    options: Array<{ value: string; label: string }>,
  ): FinanceField => ({ name, label, type: "select", options });
  const reason = field("reason", "Decision reason");
  const text = (form: FormData, name: string) =>
    String(form.get(name) ?? "").trim();
  const reasonBody = (form: FormData) => ({ reason: text(form, "reason") });
  const targetLabel = (obligationId: string) => {
    const t = data?.targets.find((t) => t.obligationId === obligationId);
    return t
      ? `${t.givenName} ${t.familyName} · ${t.categoryName}`
      : "Earlier school charge";
  };
  const currency = (form: FormData) => {
    const target = data?.targets.find(
      (t) => t.obligationId === text(form, "obligationId"),
    );
    if (!target) throw Error("Select a current school charge.");
    return target.currency;
  };
  const targets =
    data?.targets.map((t) => ({
      value: t.obligationId,
      label: `${t.givenName} ${t.familyName} · ${t.categoryName} · ${formatMinorAmount(t.amountMinor, t.currency)}`,
    })) ?? [];
  const obligation = select("obligationId", "Student charge", targets);
  const owner = data?.role === "SCHOOL_SUPER_ADMIN";
  const choices = (kind: string) =>
    data?.options
      ?.filter((x) => x.kind === kind)
      .map((x) => ({ value: x.id, label: x.label })) ?? [];
  const evidence = data?.evidence ?? [],
    allocations = data?.allocations ?? [],
    adjustments = data?.adjustments ?? [],
    reversals = data?.reversals ?? [];
  const pendingEvidence = evidence
    .filter((e) => !e.reviewAction)
    .map((e) => ({
      value: e.id,
      label: `${targetLabel(e.obligationId)} · ${formatMinorAmount(e.claimedAmountMinor, e.currency)}`,
    }));
  const pendingAdjustment = adjustments
    .filter((a) => !a.action)
    .map((a) => ({
      value: a.id,
      label: `${targetLabel(a.obligationId)} · ${a.kind === "WAIVER" ? "Fee waiver" : "Advisory correction"} · ${formatMinorAmount(a.amountMinor, a.currency)}`,
    }));
  return (
    <section
      className="financial-workspace"
      aria-label="School finance workspace"
    >
      <div className="finance-controls finance-toolbar">
        <button onClick={() => void load()}>Recheck access</button>
        {owner && <button onClick={() => void print()}>Print records</button>}
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div ref={panel} hidden={!data}>
        {data && (
          <>
            <p>
              Payment claims remain uncredited until independently verified and
              allocated. Decisions preserve the original financial history.
              Lists show recent records; school reports aggregate the complete
              ledger.
            </p>
            {owner && (
              <FinancialRecords
                accounts={data.accounts}
                receipts={data.receipts}
              />
            )}
            <div className="finance-controls">
              <h2>School finance operations</h2>
              {owner && (
                <details open>
                  <summary>Fee setup and student charges</summary>
                  <div className="finance-grid">
                    <FinanceOperationForm
                      title="Create fee category"
                      endpoint={`${root}/fee-categories`}
                      onSaved={saved}
                      requestKey={false}
                      fields={[
                        field("code", "Category code"),
                        field("name", "Category name"),
                      ]}
                      build={(f) => ({
                        code: text(f, "code"),
                        name: text(f, "name"),
                      })}
                    />
                    <FinanceOperationForm
                      title="Create fee revision"
                      endpoint={`${root}/fee-structures`}
                      onSaved={saved}
                      requestKey={false}
                      fields={[
                        select(
                          "categoryId",
                          "Fee category",
                          data.config?.categories.map((c) => ({
                            value: c.id,
                            label: c.name,
                          })) ?? [],
                        ),
                        select(
                          "sessionId",
                          "Academic session",
                          choices("SESSION"),
                        ),
                        select("termId", "Academic term", choices("TERM")),
                        select("scope", "Fee scope", [
                          { value: "SCHOOL", label: "Whole school" },
                          { value: "SECTION", label: "School section" },
                          { value: "CLASS", label: "Class" },
                        ]),
                        select("scopeId", "Scope target", [
                          { value: schoolId, label: "Whole school" },
                          ...choices("SECTION"),
                          ...choices("CLASS"),
                        ]),
                        field("currency", "Currency code (e.g. NGN)"),
                        field("amount", "Charge amount (e.g. 100.00)"),
                        reason,
                      ]}
                      build={(f) => ({
                        categoryId: text(f, "categoryId"),
                        sessionId: text(f, "sessionId"),
                        termId: text(f, "termId"),
                        scope: text(f, "scope"),
                        scopeId: text(f, "scopeId"),
                        currency: text(f, "currency"),
                        amountMinor: parseMoneyAmount(
                          text(f, "amount"),
                          text(f, "currency"),
                        ),
                        ...reasonBody(f),
                      })}
                    />
                    <FinanceOperationForm
                      title="Issue student charge"
                      endpoint={`${root}/fee-obligations`}
                      onSaved={saved}
                      fields={[
                        select(
                          "enrollmentId",
                          "Enrolled pupil",
                          choices("ENROLLMENT"),
                        ),
                        select(
                          "revisionId",
                          "Fee revision",
                          data.config?.revisions.map((r) => ({
                            value: r.id,
                            label: `${data.config?.categories.find((c) => c.id === r.categoryId)?.name ?? "Fee"} · ${formatMinorAmount(r.amountMinor, r.currency)} · version ${r.version}`,
                          })) ?? [],
                        ),
                        reason,
                      ]}
                      build={(f) => ({
                        enrollmentId: text(f, "enrollmentId"),
                        revisionId: text(f, "revisionId"),
                        ...reasonBody(f),
                      })}
                    />
                  </div>
                </details>
              )}
              {!owner && (
                <details open>
                  <summary>
                    Submit payment evidence and correction requests
                  </summary>
                  <div className="finance-grid">
                    <PaymentImageForm
                      schoolId={schoolId}
                      claims={pendingEvidence}
                      onSaved={saved}
                    />
                    <FinanceOperationForm
                      title="Submit payment reference"
                      endpoint={`${root}/payment-evidence`}
                      onSaved={saved}
                      fields={[
                        obligation,
                        {
                          ...field(
                            "transferReference",
                            "Bank reference (8–80 uppercase letters, digits or hyphens)",
                          ),
                          pattern: "[A-Z0-9-]{8,80}",
                        },
                        field("amount", "Claimed amount (e.g. 100.00)"),
                        reason,
                      ]}
                      build={(f) => ({
                        obligationId: text(f, "obligationId"),
                        transferReference: text(f, "transferReference"),
                        claimedAmountMinor: parseMoneyAmount(
                          text(f, "amount"),
                          currency(f),
                        ),
                        ...reasonBody(f),
                      })}
                    />
                    <FinanceOperationForm
                      title="Propose fee adjustment"
                      endpoint={`${root}/fee-adjustment-proposals`}
                      onSaved={saved}
                      fields={[
                        obligation,
                        select("kind", "Adjustment kind", [
                          { value: "WAIVER", label: "Fee waiver" },
                          {
                            value: "CORRECTION_PROPOSAL",
                            label:
                              "Advisory correction — does not change the charge",
                          },
                        ]),
                        field("amount", "Proposed amount (e.g. 100.00)"),
                        reason,
                      ]}
                      build={(f) => ({
                        obligationId: text(f, "obligationId"),
                        kind: text(f, "kind"),
                        proposedAmountMinor: parseMoneyAmount(
                          text(f, "amount"),
                          currency(f),
                        ),
                        ...reasonBody(f),
                      })}
                    />
                    <FinanceOperationForm
                      title="Request allocation reversal"
                      endpoint={`${root}/manual-allocation-reversals`}
                      onSaved={saved}
                      fields={[
                        select(
                          "allocationId",
                          "Manual allocation",
                          allocations
                            .filter(
                              (a) =>
                                !a.reversed &&
                                !reversals.some((r) => r.allocationId === a.id),
                            )
                            .map((a) => ({
                              value: a.id,
                              label: `${targetLabel(a.obligationId)} · ${formatMinorAmount(a.amountMinor, a.currency)}`,
                            })),
                        ),
                        reason,
                      ]}
                      build={(f) => ({
                        allocationId: text(f, "allocationId"),
                        ...reasonBody(f),
                      })}
                    />
                  </div>
                </details>
              )}
              {owner && (
                <details open>
                  <summary>
                    Independent verification, allocations and receipts
                  </summary>
                  <div className="finance-grid">
                    <FinanceOperationForm
                      title="Verify bank reference"
                      endpoint={`${root}/payment-verifications`}
                      onSaved={saved}
                      requestKey={false}
                      fields={[
                        select(
                          "evidenceId",
                          "Pending payment claim",
                          pendingEvidence,
                        ),
                        {
                          ...field(
                            "transferReference",
                            "Independently matched bank reference (8–80 uppercase letters, digits or hyphens)",
                          ),
                          pattern: "[A-Z0-9-]{8,80}",
                        },
                        {
                          name: "confirmed",
                          label:
                            "I independently confirmed the reference and amount against the bank statement.",
                          type: "checkbox",
                        },
                        reason,
                      ]}
                      build={(f) => ({
                        evidenceId: text(f, "evidenceId"),
                        action: "VERIFIED",
                        transferReference: text(f, "transferReference"),
                        fundsConfirmed: f.get("confirmed") === "on",
                        ...reasonBody(f),
                      })}
                    />
                    <FinanceOperationForm
                      title="Reject payment claim"
                      endpoint={`${root}/payment-verifications`}
                      onSaved={saved}
                      requestKey={false}
                      fields={[
                        select(
                          "evidenceId",
                          "Pending payment claim",
                          pendingEvidence,
                        ),
                        reason,
                      ]}
                      build={(f) => ({
                        evidenceId: text(f, "evidenceId"),
                        action: "REJECTED",
                        ...reasonBody(f),
                      })}
                    />
                    <FinanceOperationForm
                      title="Allocate reviewed payment"
                      endpoint={`${root}/manual-payment-allocations`}
                      onSaved={saved}
                      fields={[
                        select(
                          "verificationId",
                          "Verified payment",
                          evidence
                            .filter(
                              (e) =>
                                e.reviewAction === "VERIFIED" &&
                                e.verificationId &&
                                !allocations.some(
                                  (a) => a.verificationId === e.verificationId,
                                ),
                            )
                            .map((e) => ({
                              value: e.verificationId!,
                              label: `${targetLabel(e.obligationId)} · ${formatMinorAmount(e.claimedAmountMinor, e.currency)}`,
                            })),
                        ),
                        reason,
                      ]}
                      build={(f) => ({
                        verificationId: text(f, "verificationId"),
                        ...reasonBody(f),
                      })}
                    />
                    <FinanceOperationForm
                      title="Approve receipt"
                      endpoint={`${root}/fee-receipts`}
                      onSaved={saved}
                      fields={[
                        select(
                          "allocationId",
                          "Unreceipted allocation",
                          allocations
                            .filter((a) => !a.reversed && !a.receiptId)
                            .map((a) => ({
                              value: a.id,
                              label: `${targetLabel(a.obligationId)} · ${formatMinorAmount(a.amountMinor, a.currency)}`,
                            })),
                        ),
                        reason,
                      ]}
                      build={(f) => ({
                        allocationId: text(f, "allocationId"),
                        ...reasonBody(f),
                      })}
                    />
                  </div>
                </details>
              )}
              {owner && (
                <details open>
                  <summary>Review adjustments and reversals</summary>
                  <div className="finance-grid">
                    <FinanceOperationForm
                      title="Review fee adjustment"
                      endpoint={`${root}/fee-adjustment-decisions`}
                      onSaved={saved}
                      requestKey={false}
                      fields={[
                        select(
                          "proposalId",
                          "Adjustment proposal",
                          pendingAdjustment,
                        ),
                        select("action", "Decision", [
                          { value: "APPROVED", label: "Approve proposal" },
                          { value: "REJECTED", label: "Reject proposal" },
                        ]),
                        reason,
                      ]}
                      build={(f) => ({
                        proposalId: text(f, "proposalId"),
                        action: text(f, "action"),
                        ...reasonBody(f),
                      })}
                    />
                    <FinanceOperationForm
                      title="Apply approved waiver"
                      endpoint={`${root}/fee-waiver-applications`}
                      onSaved={saved}
                      fields={[
                        select(
                          "decisionId",
                          "Approved unapplied waiver",
                          adjustments
                            .filter(
                              (a) =>
                                a.kind === "WAIVER" &&
                                a.action === "APPROVED" &&
                                !a.applied &&
                                a.decisionId,
                            )
                            .map((a) => ({
                              value: a.decisionId!,
                              label: `${targetLabel(a.obligationId)} · ${formatMinorAmount(a.amountMinor, a.currency)}`,
                            })),
                        ),
                        reason,
                      ]}
                      build={(f) => ({
                        decisionId: text(f, "decisionId"),
                        ...reasonBody(f),
                      })}
                    />
                    <FinanceOperationForm
                      title="Review allocation reversal"
                      endpoint={`${root}/manual-allocation-reversal-decisions`}
                      onSaved={saved}
                      requestKey={false}
                      fields={[
                        select(
                          "requestId",
                          "Reversal request",
                          reversals
                            .filter((r) => !r.reviewAction)
                            .map((r) => ({
                              value: r.id,
                              label: `${formatMinorAmount(r.amountMinor, r.currency)} · request ${r.id.slice(-8)}`,
                            })),
                        ),
                        select("action", "Decision", [
                          {
                            value: "APPROVED",
                            label: "Approve full allocation reversal",
                          },
                          { value: "REJECTED", label: "Reject reversal" },
                        ]),
                        reason,
                      ]}
                      build={(f) => ({
                        requestId: text(f, "requestId"),
                        action: text(f, "action"),
                        ...reasonBody(f),
                      })}
                    />
                  </div>
                </details>
              )}
              {owner && (
                <details open>
                  <summary>Financial account visibility</summary>
                  <div className="finance-grid">
                    <FinanceOperationForm
                      title="Publish financial account"
                      endpoint={`${root}/fee-account-releases`}
                      onSaved={saved}
                      fields={[
                        obligation,
                        select("visibility", "Permitted recipients", [
                          { value: "STAFF_ONLY", label: "School owner only" },
                          {
                            value: "GUARDIAN_ONLY",
                            label: "Verified guardians only",
                          },
                          {
                            value: "STUDENT_ONLY",
                            label: "Verified student only",
                          },
                          {
                            value: "STUDENT_AND_GUARDIAN",
                            label: "Verified student and guardians",
                          },
                        ]),
                        reason,
                      ]}
                      build={(f) => ({
                        obligationId: text(f, "obligationId"),
                        action: "PUBLISHED",
                        visibility: text(f, "visibility"),
                        ...reasonBody(f),
                      })}
                    />
                    <FinanceOperationForm
                      title="Withdraw financial account"
                      endpoint={`${root}/fee-account-releases`}
                      onSaved={saved}
                      fields={[obligation, reason]}
                      build={(f) => ({
                        obligationId: text(f, "obligationId"),
                        action: "WITHDRAWN",
                        visibility: "STAFF_ONLY",
                        ...reasonBody(f),
                      })}
                    />
                  </div>
                </details>
              )}
              <h2>Private supporting evidence</h2>
              <p>
                Images support claims; they are not bank confirmation. Only the
                submitting administrator and school owner can retrieve them.
              </p>
              <ul>
                {data.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`${root}/payment-evidence-attachments/${a.id}`}>
                      Download payment evidence image (
                      {a.sizeBytes.toLocaleString("en-NG")} bytes)
                    </a>
                  </li>
                ))}
              </ul>
              <h2>Payment review history</h2>
              <div
                className="finance-table"
                role="region"
                aria-label="Scrollable financial history"
                tabIndex={0}
              >
                <table>
                  <caption>
                    {owner
                      ? "School payment review queue"
                      : "Your payment reference submissions"}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Charge</th>
                      <th scope="col">Claimed</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.map((e) => (
                      <tr key={e.id}>
                        <th scope="row">{targetLabel(e.obligationId)}</th>
                        <td>
                          {formatMinorAmount(e.claimedAmountMinor, e.currency)}
                        </td>
                        <td>{e.verificationState.replaceAll("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {owner && (
              <section
                className="financial-workspace"
                aria-label="Financial reports"
              >
                <h2>School reconciliation report</h2>
                <p>
                  Totals are separated by currency and academic period. A manual
                  reversal adjusts the school ledger; it does not send a bank
                  refund.
                </p>
                <a
                  className="finance-controls"
                  href={`${root}/finance-reports?format=csv`}
                >
                  Download financial report (CSV)
                </a>
                <div
                  className="finance-table"
                  role="region"
                  aria-label="Scrollable school finance report"
                  tabIndex={0}
                >
                  <table>
                    <caption>
                      Complete school ledger by period and currency
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Period</th>
                        <th scope="col">Charges</th>
                        <th scope="col">Waived</th>
                        <th scope="col">Allocated</th>
                        <th scope="col">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reports.map((r) => (
                        <tr
                          key={`${r.sessionName}:${r.termName}:${r.currency}`}
                        >
                          <th scope="row">
                            {r.sessionName} · {r.termName} · {r.currency}
                          </th>
                          <td>
                            {formatMinorAmount(
                              r.originalChargeMinor,
                              r.currency,
                            )}
                          </td>
                          <td>
                            {formatMinorAmount(r.waivedMinor, r.currency)}
                          </td>
                          <td>
                            {formatMinorAmount(r.allocatedMinor, r.currency)}
                          </td>
                          <td>
                            {formatMinorAmount(r.remainingMinor, r.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </section>
  );
}
