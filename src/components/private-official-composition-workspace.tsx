"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PrivateGradePreview } from "./private-grade-preview";

type Packet = { id: string; evidenceRevision: number; finalDecisionOrdinal: number;
  studentCount: number; };
type Scale = { id: string; version: number };
type Rule = { id: string; version: number };
type Composition = { id: string; sourcePacketId: string; evidenceRevision: number;
  studentCount: number; aggregationRuleVersion: number;
  gradeScaleVersion: number; status: string };
export function PrivateOfficialCompositionWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}`;
  const [packets, setPackets] = useState<Packet[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [history, setHistory] = useState<Composition[]>([]);
  const [previewId, setPreviewId] = useState("");
  const [sourcePacketId, setSourcePacketId] = useState("");
  const [gradeScaleId, setGradeScaleId] = useState("");
  const [aggregationRuleId, setAggregationRuleId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`${root}/report-card-source-packets`, { cache: "no-store" }),
      fetch(`${root}/report-grade-scales`, { cache: "no-store" }),
      fetch(`${root}/report-aggregation-rules`, { cache: "no-store" }),
      fetch(`${root}/private-official-report-compositions`, { cache: "no-store" }),
    ]).then(async responses => {
      if (responses.some(r => !r.ok)) throw new Error("Failed to load owner metadata");
      return Promise.all(responses.map(r => r.json()));
    }).then(([packetData, scaleData, ruleData, historyData]) => {
      if (!live) return;
      setPackets(packetData.packets); setScales(scaleData.scales);
      setRules(ruleData.rules); setHistory(historyData.compositions);
    }).catch(() => {
      if (live) {
        setPackets([]); setScales([]); setRules([]); setHistory([]);
        setMessage("Unable to verify school report sources or policies. Nothing composed or released.");
      }
    });
    return () => { live = false; };
  }, [root, refresh]);
  const currentScale = scales[0], currentRule = rules[0];
  const available = packets.filter(p => !history.some(h => h.sourcePacketId === p.id));
  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !sourcePacketId || !gradeScaleId || !aggregationRuleId ||
      gradeScaleId !== currentScale?.id || aggregationRuleId !== currentRule?.id ||
      reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${root}/private-official-report-compositions`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePacketId, gradeScaleId,
          aggregationRuleId, reason }),
      });
      if (!response.ok) throw new Error("Composition rejected");
      setPreviewId("");
      setMessage("Private report evidence frozen. No student or guardian result has been released.");
      setSourcePacketId(""); setGradeScaleId(""); setAggregationRuleId("");
      setReason(""); setRefresh(v => v + 1);
    } catch {
      setMessage("Composition denied. School policies, approved results or permissions may have changed.");
    } finally { setBusy(false); }
  }
  return <section className="school-card" aria-labelledby="official-source-heading">
    <h2 id="official-source-heading">Internal official-grade evidence — not published</h2>
    <p>Select the frozen approved source packet and the school's current adopted
      aggregation and grading-scale revisions. The server independently
      recomputes marks and grade bands in PostgreSQL. This does not give anyone
      a report card, download, result portal or release permission.</p>
    <form onSubmit={prepare}>
      <label htmlFor="official-source-packet">Approved frozen source</label>
      <select id="official-source-packet" value={sourcePacketId} required
        onChange={e => setSourcePacketId(e.target.value)}>
        <option value="">Choose the frozen source packet</option>
        {available.map(p => <option key={p.id} value={p.id}>
          Evidence version {p.evidenceRevision}, owner approval {p.finalDecisionOrdinal},
          {p.studentCount} pupils
        </option>)}
      </select>
      <label htmlFor="official-scale">Adopted grading-scale revision</label>
      <select id="official-scale" value={gradeScaleId} required
        onChange={e => setGradeScaleId(e.target.value)}>
        <option value="">Choose current school grade scale</option>
        {currentScale && <option value={currentScale.id}>
          Grade scale revision {currentScale.version}
        </option>}
      </select>
      <label htmlFor="official-aggregation">Adopted aggregation revision</label>
      <select id="official-aggregation" value={aggregationRuleId} required
        onChange={e => setAggregationRuleId(e.target.value)}>
        <option value="">Choose current school aggregation rule</option>
        {currentRule && <option value={currentRule.id}>
          Aggregation revision {currentRule.version}
        </option>}
      </select>
      <label htmlFor="official-composition-reason">Reason for immutable composition</label>
      <textarea id="official-composition-reason" required minLength={5} maxLength={500}
        value={reason} onChange={e => setReason(e.target.value)} />
      <button type="submit" disabled={busy || !sourcePacketId ||
        !gradeScaleId || !aggregationRuleId || reason.trim().length < 5}>
        Freeze private official evidence (no release)
      </button>
    </form>
    <h3>Private composition history</h3>
    <ul>{history.map(h => <li key={h.id}>
      Evidence revision {h.evidenceRevision}, {h.studentCount} pupils;
      aggregation revision {h.aggregationRuleVersion},
      scale revision {h.gradeScaleVersion} — {h.status}
      <button type="button" onClick={() => setPreviewId(h.id)}>
        Inspect private grades (not released)
      </button>
    </li>)}</ul>
    {previewId && <PrivateGradePreview key={previewId} schoolId={schoolId}
      compositionId={previewId} onClose={() => setPreviewId("")} />}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
