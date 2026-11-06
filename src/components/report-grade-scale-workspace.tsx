"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  validateReportGradeScale,
  simulateSchoolGradeScale,
  type ReportGradeScalePolicy,
} from "@/src/modules/results/report-grade-scale";

type Scale = ReportGradeScalePolicy & {
  id: string;
  version: number;
  reason: string;
  adoptedAt: string;
};
const emptyBands = "";
export function ReportGradeScaleWorkspace({ schoolId }: { schoolId: string }) {
  const [history, setHistory] = useState<Scale[]>([]);
  const [bandsJson, setBandsJson] = useState(emptyBands);
  const [decimalPlaces, setDecimalPlaces] = useState<0 | 1 | 2 | null>(null);
  const [roundingMode, setRoundingMode] = useState<
    "HALF_UP" | "FLOOR" | "CEILING" | ""
  >("");
  const [bandBasis, setBandBasis] = useState<
    "RAW_BPS" | "DISPLAY_ROUNDED_BPS" | ""
  >("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const root = `/api/schools/${encodeURIComponent(schoolId)}/report-grade-scales`;
  useEffect(() => {
    let active = true;
    fetch(root, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((body: { scales: Scale[] }) => {
        if (active) setHistory(body.scales);
      })
      .catch(() => {
        if (active) {
          setHistory([]);
          setMessage("Grading policy history unavailable.");
        }
      });
    return () => {
      active = false;
    };
  }, [root, refresh]);
  function readPolicy(): ReportGradeScalePolicy | null {
    try {
      const bands: unknown = JSON.parse(bandsJson);
      const proposed = { bands, decimalPlaces, roundingMode, bandBasis };
      return validateReportGradeScale(proposed) ? proposed : null;
    } catch {
      return null;
    }
  }
  const policy = readPolicy();
  async function adopt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !policy || reason.trim().length < 5) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(root, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...policy, reason }),
      });
      if (!response.ok) throw new Error();
      setMessage(
        "New school grading-scale version adopted. Historical results are unchanged; nothing is published.",
      );
      setBandsJson("");
      setReason("");
      setRefresh((n) => n + 1);
    } catch {
      setMessage(
        "Adoption denied. Check the exact bands and owner permissions; identical revisions cannot be repeated.",
      );
    } finally {
      setBusy(false);
    }
  }
  const example = policy ? simulateSchoolGradeScale(policy, 7555) : null;
  return (
    <section className="school-card" aria-labelledby="scale-title">
      <h2 id="scale-title">Versioned school report-grade bands</h2>
      <p>
        School Super Admin only. The school must explicitly choose all grade
        bands and rounding options. These are example-policy simulations only,
        not official grades or published report cards. Older adopted versions
        remain immutable.
      </p>
      <form onSubmit={adopt}>
        <label htmlFor="school-grade-bands">Grade bands JSON</label>
        <p>
          Use an ascending array of 1–20 objects with keys code, remark, minBps
          and maxBps. Boundaries are integer basis points from 0 to 10000
          inclusive: all values must be covered once, with no gaps or overlaps.
          No grade scale is automatically supplied.
        </p>
        <textarea
          id="school-grade-bands"
          required
          value={bandsJson}
          onChange={(event) => setBandsJson(event.target.value)}
          aria-describedby="school-grade-bands-validation"
        />
        <p id="school-grade-bands-validation">
          {bandsJson.length
            ? policy
              ? "All grade ranges are valid."
              : "Enter a valid ascending and complete 0–10000 grade range."
            : "No school grading bands entered."}
        </p>
        <label htmlFor="grade-decimals">
          Displayed percentage decimal places
        </label>
        <select
          id="grade-decimals"
          value={decimalPlaces ?? ""}
          required
          onChange={(event) =>
            setDecimalPlaces(
              event.target.value === ""
                ? null
                : (Number(event.target.value) as 0 | 1 | 2),
            )
          }
        >
          <option value="">Choose display precision</option>
          <option value={0}>Whole percentage</option>
          <option value={1}>One decimal place</option>
          <option value={2}>Two decimal places</option>
        </select>
        <label htmlFor="grade-rounding">Rounding method</label>
        <select
          id="grade-rounding"
          value={roundingMode}
          required
          onChange={(event) =>
            setRoundingMode(event.target.value as typeof roundingMode)
          }
        >
          <option value="">Choose rounding mode</option>
          <option value="HALF_UP">Half up</option>
          <option value="FLOOR">Round down</option>
          <option value="CEILING">Round up</option>
        </select>
        <label htmlFor="grade-band-basis">Apply grade thresholds to</label>
        <select
          id="grade-band-basis"
          value={bandBasis}
          required
          onChange={(event) =>
            setBandBasis(event.target.value as typeof bandBasis)
          }
        >
          <option value="">Choose the threshold basis</option>
          <option value="RAW_BPS">Original unrounded score</option>
          <option value="DISPLAY_ROUNDED_BPS">Displayed rounded score</option>
        </select>
        {example && (
          <p>
            Private simulation for 75.55%: {example.displayPercent}%, band{" "}
            {example.gradeCode} ({example.remark}).
          </p>
        )}
        <label htmlFor="grade-scale-reason">Adoption reason (audit)</label>
        <textarea
          id="grade-scale-reason"
          minLength={5}
          maxLength={500}
          value={reason}
          required
          onChange={(event) => setReason(event.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !policy || reason.trim().length < 5}
        >
          Adopt immutable grading scale (no report release)
        </button>
      </form>
      <h3>School-owned scale history</h3>
      <ul>
        {history.map((item) => (
          <li key={item.id}>
            Version {item.version}: {item.bands.length} bands,
            {item.roundingMode.toLowerCase()} to {item.decimalPlaces} decimal
            places,
            {item.bandBasis} — {item.reason}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
