import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublishedReportWorkspace } from "./published-report-workspace";

describe("published subject report privacy and print shell", () => {
  it("renders no pupil identity, grades, or guardian receipt before verified recipient data arrives", () => {
    // React effects do not execute during server rendering. An authenticated
    // client-side recipient check must finish before any grade can be shown;
    // SSR must never embed a cached pupil record in this page.
    const html = renderToStaticMarkup(
      createElement(PublishedReportWorkspace, { schoolId: "synthetic-school" }),
    );
    expect(html).toContain("Verifying recipient access");
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain("Print authorized subject report");
    expect(html).toContain("@media print");
    // Keyboard Ctrl+P or a restored back-forward cached page cannot print
    // rows without the explicit, freshly reauthorized print workflow.
    expect(html).toContain('data-print-authorized="false"');
    expect(html).toContain(
      '.published-report-workspace[data-print-authorized="false"] article',
    );
    for (const sensitive of [
      "Admission number:",
      "Individually authorized subject grades",
      "Acknowledge this published subject",
      "studentSourceCards",
      "composedStudentCards",
      "correctIndex",
    ]) {
      expect(html).not.toContain(sensitive);
    }
  });
});
