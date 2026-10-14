import type { NextConfig } from "next";

// Defense in depth for server-rendered Phase 8 pages. API responses also
// carry their own private/no-store headers. Browser history may retain
// rendered DOM, so the client must still discard and reauthorize grades.
const privatePhase8Routes = [
  "/schools/:schoolId/published-reports",
  "/schools/:schoolId/report-publication",
  "/schools/:schoolId/private-report-compositions",
  "/schools/:schoolId/guardian-links",
] as const;

const privatePhase8Headers = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Pragma", value: "no-cache" },
  { key: "X-Robots-Tag", value: "noindex, noarchive, nosnippet" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  async headers() {
    return privatePhase8Routes.map((source) => ({
      source,
      headers: privatePhase8Headers,
    }));
  },
};

export default nextConfig;
