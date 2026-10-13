"use client";
import { useEffect, useState, type FormEvent } from "react";
type GuardianLink = {
  id: string; studentId: string; guardianMembershipId: string;
  createdAt: string; revokedAt: string | null;
};
export function GuardianLinkWorkspace({ schoolId }: { schoolId: string }) {
  const root = `/api/schools/${encodeURIComponent(schoolId)}/guardian-links`;
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [studentId, setStudentId] = useState("");
  const [guardianMembershipId, setGuardianMembershipId] = useState("");
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const [revokeReasons, setRevokeReasons] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch(root, { cache: "no-store", credentials: "same-origin" })
      .then(async r => { if (!r.ok) throw Error("Denied"); return r.json(); })
      .then(data => { if (active) setLinks(data.links); })
      .catch(() => { if (active) { setLinks([]); setMessage("Guardian links unavailable."); } });
    return () => { active = false; };
  }, [root, refresh]);
  async function attest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !verified || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch(root, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId.trim(),
          guardianMembershipId: guardianMembershipId.trim(),
          reason, identityVerified: true,
        }),
      });
      if (!r.ok) throw Error("Rejected");
      setStudentId(""); setGuardianMembershipId(""); setReason("");
      setVerified(false); setMessage("Guardian relationship verified and audited. This does not grant report access.");
      setRefresh(v => v + 1);
    } catch {
      setMessage("Attestation denied. Check exact active parent membership and enrolled pupil; no link was assumed.");
    } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    const justification = revokeReasons[id]?.trim() ?? "";
    if (busy || justification.length < 5) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch(`${root}/${encodeURIComponent(id)}/revoke`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: justification }),
      });
      if (!r.ok) throw Error("Rejected");
      setMessage("Guardian relationship revoked permanently. Historic attestation was retained.");
      setRefresh(v => v + 1);
    } catch {
      setMessage("Revocation denied or already recorded.");
    } finally { setBusy(false); }
  }
  return <section className="school-card">
    <h2>Verify family account relationship</h2>
    <p>Use the exact enrolled StudentRecord identifier and exact active
      PARENT membership identifier. Do not infer family identity from names,
      emails or admission numbers. This private verification is not
      a publication, child report permission or portal release.</p>
    <form onSubmit={attest}>
      <label htmlFor="guardian-student-id">Enrolled pupil record ID</label>
      <input id="guardian-student-id" required maxLength={128}
        value={studentId} onChange={event => setStudentId(event.target.value)} />
      <label htmlFor="guardian-membership-id">Verified parent membership ID</label>
      <input id="guardian-membership-id" required maxLength={128}
        value={guardianMembershipId}
        onChange={event => setGuardianMembershipId(event.target.value)} />
      <label htmlFor="guardian-verification-reason">Accountable identity verification reason</label>
      <textarea id="guardian-verification-reason" required minLength={5}
        maxLength={500} value={reason}
        onChange={event => setReason(event.target.value)} />
      <label>
        <input type="checkbox" checked={verified}
          onChange={event => setVerified(event.target.checked)} />
        I independently verified the guardian identity and relationship
        to this exact enrolled pupil.
      </label>
      <button disabled={busy || !verified || reason.trim().length < 5}>
        Attest immutable guardian relationship
      </button>
    </form>
    <h3>School relationship audit (identifiers only)</h3>
    <ul>{links.map(link => <li key={link.id}>
      Pupil {link.studentId} — parent member {link.guardianMembershipId},
      {link.revokedAt ? "revoked" : "active relationship"}
      {!link.revokedAt && <div>
        <label htmlFor={`revoke-${link.id}`}>Reason for terminal revocation</label>
        <input id={`revoke-${link.id}`} minLength={5} maxLength={500}
          value={revokeReasons[link.id] ?? ""}
          onChange={e => setRevokeReasons(all => ({
            ...all, [link.id]: e.target.value,
          }))} />
        <button disabled={busy || (revokeReasons[link.id]?.trim().length ?? 0) < 5}
          onClick={() => revoke(link.id)}>Revoke permanently</button>
      </div>}
    </li>)}</ul>
    <p aria-live="polite" role="status">{message}</p>
  </section>;
}
