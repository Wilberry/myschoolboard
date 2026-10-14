"use client";

import { useEffect, useState, type FormEvent } from "react";
type Method = "EQUAL_ASSESSMENT_BPS" | "POOLED_CATEGORY_POINTS";
type Mode = "HALF_UP" | "FLOOR" | "CEILING";
type Rule = {
  id: string;
  version: number;
  categoryMethod: Method;
  precisionMode: Mode;
  reason: string;
};
export function ReportAggregationRuleWorkspace({
  schoolId,
}: {
  schoolId: string;
}) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}/report-aggregation-rules`;
  const [categoryMethod, setCategoryMethod] = useState<Method | "">("");
  const [precisionMode, setPrecisionMode] = useState<Mode | "">("");
  const [reason, setReason] = useState("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(root, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((body: { rules: Rule[] }) => {
        if (active) setRules(body.rules);
      })
      .catch(() => {
        if (active) {
          setRules([]);
          setMessage("School calculation policy history unavailable.");
        }
      });
    return () => {
      active = false;
    };
  }, [root, refresh]);
  async function adopt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !categoryMethod || !precisionMode || reason.trim().length < 5)
      return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(root, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryMethod, precisionMode, reason }),
      });
      if (!response.ok) throw new Error();
      setMessage(
        "School calculation rule adopted and versioned. No grade or report has been released.",
      );
      setCategoryMethod("");
      setPrecisionMode("");
      setReason("");
      setRefresh((value) => value + 1);
    } catch {
      setMessage(
        "Adoption denied. Check your current permissions and rule values.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-card" aria-labelledby="aggregation-heading">
      <h2 id="aggregation-heading">Immutable category-aggregation policy</h2>
      <p>
        Choose how graded assessments are combined within QUIZ, TEST and EXAM.
        Separately adopted category weights and grade bands will be pinned when
        a private report is composed. Every intermediate division follows the
        selected precision rule. No formula is adopted automatically.
      </p>
      <form onSubmit={adopt}>
        <label htmlFor="report-category-method">
          Assessment combination within a category
        </label>
        <select
          id="report-category-method"
          required
          value={categoryMethod}
          onChange={(event) =>
            setCategoryMethod(event.target.value as Method | "")
          }
        >
          <option value="">Select an aggregation method</option>
          <option value="EQUAL_ASSESSMENT_BPS">
            Equal weighting per assessment, each normalized to 0–100%
          </option>
          <option value="POOLED_CATEGORY_POINTS">
            Pool all earned and possible points
          </option>
        </select>
        <label htmlFor="report-precision-mode">
          Intermediate basis-point rounding
        </label>
        <select
          id="report-precision-mode"
          required
          value={precisionMode}
          onChange={(event) =>
            setPrecisionMode(event.target.value as Mode | "")
          }
        >
          <option value="">Select a rounding mode</option>
          <option value="HALF_UP">Half up</option>
          <option value="FLOOR">Round down</option>
          <option value="CEILING">Round up</option>
        </select>
        <p>
          Equal weighting rounds each assessment percentage to integer basis
          points, then rounds the category mean. Pooling rounds the ratio of
          total earned to total possible points. Both methods apply adopted
          category weights and round the final percentage to integer basis
          points.
        </p>
        <label htmlFor="report-aggregation-reason">
          Reason for school adoption
        </label>
        <textarea
          id="report-aggregation-reason"
          required
          minLength={5}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <button
          type="submit"
          disabled={
            busy ||
            !categoryMethod ||
            !precisionMode ||
            reason.trim().length < 5
          }
        >
          Adopt calculation rule (no report publication)
        </button>
      </form>
      <h3>Adoption history</h3>
      <ul>
        {rules.map((rule) => (
          <li key={rule.id}>
            Version {rule.version}: {rule.categoryMethod}, {rule.precisionMode}{" "}
            — {rule.reason}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
