"use client";

import { useEffect, useState, type FormEvent } from "react";

type Feature = "ATTENDANCE" | "LESSONS" | "ASSESSMENTS" | "CBT";
type School = {
  id: string;
  name: string;
  slug: string;
  lifecycleStatus: string | null;
  isActive: boolean;
};
type Plan = {
  id: string;
  code: string;
  version: number;
  name: string;
  features: Feature[];
  maxStudents: number | null;
  maxStaff: number | null;
};
type Period = {
  id: string;
  startsAt: string;
  endsAt: string;
  periodStatus: "UPCOMING" | "CURRENT" | "ENDED";
  planRevision: Plan;
};
const features: Feature[] = ["ATTENDANCE", "LESSONS", "ASSESSMENTS", "CBT"];

async function privateJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("Request denied");
  return response.json();
}

export function PlatformSubscriptionEditor({ schools }: { schools: School[] }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [planRevisionId, setPlanRevisionId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Feature[]>(["ATTENDANCE"]);
  const [maxStudents, setMaxStudents] = useState("");
  const [maxStaff, setMaxStaff] = useState("");
  const [planReason, setPlanReason] = useState("");
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const [periodReason, setPeriodReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    privateJson("/api/platform/plans")
      .then((data: { plans: Plan[] }) => {
        if (active) setPlans(data.plans);
      })
      .catch(() => {
        if (active) setError("The private plan catalog could not be loaded.");
      });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!schoolId) {
      setPeriods([]);
      return;
    }
    let active = true;
    setPeriods([]);
    privateJson(
      "/api/platform/schools/" + encodeURIComponent(schoolId) + "/subscriptions",
    )
      .then((data: { subscriptions: Period[] }) => {
        if (active) setPeriods(data.subscriptions);
      })
      .catch(() => {
        if (active) setError("Subscription history could not be loaded.");
      });
    return () => { active = false; };
  }, [schoolId, refresh]);

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || selectedFeatures.length === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await privateJson("/api/platform/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          features: selectedFeatures,
          maxStudents: maxStudents === "" ? null : Number(maxStudents),
          maxStaff: maxStaff === "" ? null : Number(maxStaff),
          reason: planReason,
        }),
      }) as { plan: Plan };
      setMessage(
        "Plan " + data.plan.code + " revision " + data.plan.version +
        " recorded. No school permissions or payments changed.",
      );
      setPlanRevisionId(data.plan.id);
      setPlanReason("");
      setRefresh((n) => n + 1);
    } catch {
      setError("Plan revision rejected. Check the fields and current operator access.");
    } finally {
      setBusy(false);
    }
  }

  async function savePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !schoolId || !planRevisionId || !startsLocal || !endsLocal)
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const startsAt = new Date(startsLocal).toISOString();
      const endsAt = new Date(endsLocal).toISOString();
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error("Invalid window");
      await privateJson(
        "/api/platform/schools/" + encodeURIComponent(schoolId) + "/subscriptions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planRevisionId, startsAt, endsAt, reason: periodReason,
          }),
        },
      );
      setMessage(
        "Subscription period recorded. School activation, billing and quotas are unchanged.",
      );
      setPeriodReason("");
      setRefresh((n) => n + 1);
    } catch {
      setError(
        "Period rejected. Check dates, overlap, school lifecycle and operator authorization.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="school-card" aria-labelledby="plan-revision-heading">
        <h2 id="plan-revision-heading">Create immutable plan revision</h2>
        <p>
          Reusing a plan code creates the next version. Earlier versions
          and school subscriptions remain unchanged.
        </p>
        <form onSubmit={savePlan}>
          <label htmlFor="platform-plan-code">Plan code</label>
          <input id="platform-plan-code" required minLength={3} maxLength={36}
            pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*"
            value={code} onChange={(e) => setCode(e.target.value)} />
          <label htmlFor="platform-plan-name">Plan display name</label>
          <input id="platform-plan-name" required minLength={3} maxLength={100}
            value={name} onChange={(e) => setName(e.target.value)} />
          <fieldset>
            <legend>Catalog features (metadata only)</legend>
            {features.map((feature) => (
              <label key={feature}>
                <input type="checkbox" value={feature}
                  checked={selectedFeatures.includes(feature)}
                  onChange={(e) => setSelectedFeatures((current) => e.target.checked
                    ? [...current, feature]
                    : current.filter((item) => item !== feature))}
                />
                {feature}
              </label>
            ))}
          </fieldset>
          <label htmlFor="platform-max-students">Advisory maximum students (optional)</label>
          <input id="platform-max-students" type="number" min={1} max={1000000}
            step={1} value={maxStudents}
            onChange={(e) => setMaxStudents(e.target.value)} />
          <label htmlFor="platform-max-staff">Advisory maximum staff (optional)</label>
          <input id="platform-max-staff" type="number" min={1} max={1000000}
            step={1} value={maxStaff}
            onChange={(e) => setMaxStaff(e.target.value)} />
          <label htmlFor="platform-plan-reason">Reason for this revision</label>
          <textarea id="platform-plan-reason" required minLength={5} maxLength={500}
            value={planReason} onChange={(e) => setPlanReason(e.target.value)} />
          <button type="submit" disabled={busy || selectedFeatures.length === 0}>
            Record plan revision
          </button>
        </form>
        <h3>Plan catalog (first 100 code-sorted revisions)</h3>
        {plans.length ? (
          <ul>
            {plans.map((plan) => (
              <li key={plan.id}>
                <strong>{plan.name}</strong> — {plan.code}, revision {plan.version};
                features: {plan.features.join(", ")};
                student cap: {plan.maxStudents ?? "not set"};
                staff cap: {plan.maxStaff ?? "not set"} (not enforced)
              </li>
            ))}
          </ul>
        ) : <p>No plan revisions available.</p>}
      </section>

      <section className="school-card" aria-labelledby="subscription-period-heading">
        <h2 id="subscription-period-heading">Assign a school subscription period</h2>
        <p>
          Each interval is immutable and cannot overlap another period for
          the same school. An active subscription is not school activation.
        </p>
        <form onSubmit={savePeriod}>
          <label htmlFor="platform-period-school">School</label>
          <select id="platform-period-school" required value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}>
            <option value="">Choose a school</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name} ({school.lifecycleStatus ?? "UNCLASSIFIED"})
              </option>
            ))}
          </select>
          <label htmlFor="platform-period-plan">Exact plan revision</label>
          <select id="platform-period-plan" required value={planRevisionId}
            onChange={(e) => setPlanRevisionId(e.target.value)}>
            <option value="">Choose a revision</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.code} v{plan.version} — {plan.name}
              </option>
            ))}
          </select>
          <label htmlFor="platform-period-start">Starts (your local time)</label>
          <input id="platform-period-start" type="datetime-local" required
            value={startsLocal} onChange={(e) => setStartsLocal(e.target.value)} />
          <label htmlFor="platform-period-end">Ends (your local time)</label>
          <input id="platform-period-end" type="datetime-local" required
            value={endsLocal} onChange={(e) => setEndsLocal(e.target.value)} />
          <label htmlFor="platform-period-reason">Reason for assigning this period</label>
          <textarea id="platform-period-reason" required minLength={5} maxLength={500}
            value={periodReason} onChange={(e) => setPeriodReason(e.target.value)} />
          <button type="submit" disabled={busy || !schoolId || !planRevisionId}>
            Record subscription period
          </button>
        </form>
        <h3>Recorded periods for the selected school</h3>
        {periods.length ? (
          <ul>
            {periods.map((period) => (
              <li key={period.id}>
                <strong>{period.planRevision.code} v{period.planRevision.version}</strong>
                {" "}— {period.periodStatus};
                {" "}UTC {new Date(period.startsAt).toISOString()} to
                {" "}{new Date(period.endsAt).toISOString()}
              </li>
            ))}
          </ul>
        ) : <p>No subscription periods recorded for this school.</p>}
      </section>
      <p role="status" aria-live="polite">{message}</p>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
