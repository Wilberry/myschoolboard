"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
import { listenForSessionSignOut } from "@/src/lib/auth-session-events";

interface PreparedPupil {
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  objectiveAssessments: number;
  unscoredObjectiveAssessments: number;
  manualComponents: number;
  unapprovedManualComponents: number;
  pendingManualCorrections: number;
  status: "NEEDS_SOURCE_WORK" | "SOURCES_RECONCILED_NOT_APPROVED";
  blockers: string[];
}
interface Readiness {
  status: "PRIVATE_PREPARATION_ONLY";
  gradingPolicyVersion: number | null;
  studentCount: number;
  blockedCount: number;
  students: PreparedPupil[];
}
interface PreparationScope {
  classId: string;
  sessionId: string;
  subjectId: string;
  termId: string;
}
const RECHECK_MS = 10_000;
const REQUEST_TIMEOUT_MS = 5_000;
const unavailable =
  "Preparation unavailable. Assignment access or student enrollment may have changed.";
const blockerNames: Record<string, string> = {
  NO_ASSESSMENT_SOURCE: "No assessment evidence recorded",
  OBJECTIVE_SCORING_PENDING: "Objective marking is incomplete",
  MANUAL_REVIEW_PENDING: "Written marks await independent academic approval",
  MANUAL_CORRECTION_PENDING: "A written-mark correction awaits review",
  GRADING_POLICY_NOT_ADOPTED:
    "A school grading profile has not been formally adopted",
};

function isReadiness(value: unknown): value is Readiness {
  if (!value || typeof value !== "object") return false;
  const readiness = value as Partial<Readiness>;
  return (
    readiness.status === "PRIVATE_PREPARATION_ONLY" &&
    Number.isSafeInteger(readiness.studentCount) &&
    readiness.studentCount === readiness.students?.length &&
    Number.isSafeInteger(readiness.blockedCount) &&
    Array.isArray(readiness.students)
  );
}

export function ResultPreparationWorkspace({
  schoolId,
  options,
}: {
  schoolId: string;
  options: LessonWritingOptions;
}) {
  const [assignmentId, setAssignmentId] = useState("");
  const [termId, setTermId] = useState("");
  const [view, setView] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const epoch = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const authorized = useRef(false);
  const scope = useRef<PreparationScope | null>(null);
  const privatePanel = useRef<HTMLDivElement | null>(null);
  const assignment = options.assignments.find((a) => a.id === assignmentId);
  const terms = options.terms.filter(
    (t) => t.sessionId === assignment?.sessionId,
  );

  const conceal = useCallback((status = "") => {
    epoch.current += 1;
    pending.current?.abort();
    pending.current = null;
    authorized.current = false;
    if (privatePanel.current) privatePanel.current.hidden = true;
    setView(null);
    setBusy(false);
    setMessage(status);
  }, []);

  const revalidate = useCallback(
    async (target: PreparationScope | null, concealFirst: boolean) => {
      if (!target || document.visibilityState !== "visible") return;
      const requestEpoch = ++epoch.current;
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      if (concealFirst) {
        authorized.current = false;
        if (privatePanel.current) privatePanel.current.hidden = true;
        setView(null);
        setMessage("Rechecking result preparation access…");
      }
      setBusy(true);
      const deadline = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );
      const query = new URLSearchParams({
        classId: target.classId,
        sessionId: target.sessionId,
        subjectId: target.subjectId,
        termId: target.termId,
      });
      try {
        const response = await fetch(
          `/api/schools/${encodeURIComponent(schoolId)}/result-preparation?${query}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) throw Error("Access denied");
        const result = (await response.json()) as { preparation?: unknown };
        if (!isReadiness(result.preparation)) {
          throw Error("Invalid preparation response");
        }
        if (
          requestEpoch !== epoch.current ||
          controller.signal.aborted ||
          scope.current !== target
        ) {
          return;
        }
        if (document.visibilityState !== "visible") {
          conceal("Student information is concealed while this tab is hidden.");
          return;
        }
        setView(result.preparation);
        setMessage(
          "Private preflight loaded. No results were approved or published.",
        );
        authorized.current = true;
        if (privatePanel.current) privatePanel.current.hidden = false;
      } catch {
        if (requestEpoch !== epoch.current) return;
        authorized.current = false;
        if (privatePanel.current) privatePanel.current.hidden = true;
        setView(null);
        setMessage(unavailable);
      } finally {
        window.clearTimeout(deadline);
        if (pending.current === controller) pending.current = null;
        if (requestEpoch === epoch.current) setBusy(false);
      }
    },
    [conceal, schoolId],
  );

  useEffect(() => {
    const panelElement = privatePanel.current;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        conceal("Student information is concealed while this tab is hidden.");
      } else {
        void revalidate(scope.current, true);
      }
    };
    const handleFocus = () => {
      if (document.visibilityState === "visible")
        void revalidate(scope.current, true);
    };
    const handlePageHide = () => conceal();
    const handleBeforePrint = () => {
      conceal("Private result preparation is not available for printing.");
    };
    const handleAfterPrint = () => {
      if (document.visibilityState === "visible")
        void revalidate(scope.current, true);
    };
    const handleSignOut = () => {
      scope.current = null;
      setAssignmentId("");
      setTermId("");
      conceal("Session ended. Sign in again to check result access.");
    };
    const interval = window.setInterval(() => {
      if (authorized.current && document.visibilityState === "visible") {
        void revalidate(scope.current, false);
      }
    }, RECHECK_MS);
    const unsubscribeSignOut = listenForSessionSignOut(handleSignOut);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handlePageHide);
    window.addEventListener("pageshow", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.clearInterval(interval);
      unsubscribeSignOut();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handlePageHide);
      window.removeEventListener("pageshow", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      epoch.current += 1;
      pending.current?.abort();
      if (panelElement) panelElement.hidden = true;
    };
  }, [conceal, revalidate]);

  useEffect(() => {
    const selected = scope.current;
    if (!selected) return;
    const stillAssigned = options.assignments.some(
      (item) =>
        item.classId === selected.classId &&
        item.sessionId === selected.sessionId &&
        item.subjectId === selected.subjectId,
    );
    const termStillAvailable = options.terms.some(
      (term) =>
        term.id === selected.termId && term.sessionId === selected.sessionId,
    );
    if (!stillAssigned || !termStillAvailable) {
      scope.current = null;
      setAssignmentId("");
      setTermId("");
      conceal(unavailable);
    }
  }, [options.assignments, options.terms, conceal]);

  function clearSelection() {
    scope.current = null;
    conceal();
  }

  function load() {
    if (!assignment || !termId || busy) return;
    const target = {
      classId: assignment.classId,
      sessionId: assignment.sessionId,
      subjectId: assignment.subjectId,
      termId,
    };
    scope.current = target;
    void revalidate(target, true);
  }

  return (
    <section className="school-card" aria-labelledby="result-prep-title">
      <h2 id="result-prep-title">Result-sheet preparation checklist</h2>
      <p>
        This is a confidential teacher-only preflight, not a result sheet,
        approved grade, report card or final publication. It checks source
        completeness without combining CBT and manual scores or exposing answer
        keys.
      </p>
      <label htmlFor="result-prep-assignment">
        Current assigned class and subject
      </label>
      <select
        id="result-prep-assignment"
        value={assignmentId}
        onChange={(event) => {
          clearSelection();
          setAssignmentId(event.target.value);
          setTermId("");
        }}
      >
        <option value="">Choose assignment</option>
        {options.assignments.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <label htmlFor="result-prep-term">Active academic term</label>
      <select
        id="result-prep-term"
        value={termId}
        onChange={(event) => {
          clearSelection();
          setTermId(event.target.value);
        }}
      >
        <option value="">Choose term</option>
        {terms.map((term) => (
          <option key={term.id} value={term.id}>
            {term.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!assignment || !termId || busy}
        onClick={load}
      >
        Check result source readiness
      </button>
      <div ref={privatePanel} hidden>
        {view && (
          <div>
            <p>
              <strong>{view.studentCount}</strong> enrolled students reviewed;
              <strong> {view.blockedCount}</strong> with incomplete source
              evidence. Grading profile revision:{" "}
              {view.gradingPolicyVersion ?? "Not configured"}. Even a configured
              revision is only a draft, not adopted for official results.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table>
                <caption>
                  Private academic source reconciliation — not an official
                  report
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Admission</th>
                    <th scope="col">Student</th>
                    <th scope="col">CBT evidence</th>
                    <th scope="col">Written evidence</th>
                    <th scope="col">Preparation blockers</th>
                  </tr>
                </thead>
                <tbody>
                  {view.students.map((student) => (
                    <tr key={student.studentId}>
                      <th scope="row">{student.admissionNumber}</th>
                      <td>
                        {student.givenName} {student.familyName}
                      </td>
                      <td>
                        {student.objectiveAssessments} assessments;{" "}
                        {student.unscoredObjectiveAssessments} unscored
                      </td>
                      <td>
                        {student.manualComponents} components;{" "}
                        {student.unapprovedManualComponents} unapproved;{" "}
                        {student.pendingManualCorrections} pending corrections
                      </td>
                      <td>
                        <ul>
                          {student.blockers.map((code) => (
                            <li key={code}>
                              {blockerNames[code] ??
                                "Academic policy review required"}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
