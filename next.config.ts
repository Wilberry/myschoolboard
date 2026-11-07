import type { NextConfig } from "next";

// These school routes perform session, tenant, enrollment and revocation
// checks at request time. Keep both HTML/Flight and partial route-shell
// prefetches out of browser and shared HTTP caches. Authorization remains
// mandatory in the page and API handlers; headers do not grant access.
const privateSchoolRouteHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-cache, no-store, max-age=0, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      ...[
        "/schools/:schoolId/notices",
        "/schools/:schoolId/notices/:path*",
        "/schools/:schoolId/notices.segments/:path*",
      ].map((source) => ({ source, headers: privateSchoolRouteHeaders })),
      {
        source: "/schools/:schoolId/finance",
        headers: privateSchoolRouteHeaders,
      },
      {
        source: "/schools/:schoolId/finance.segments/:path*",
        headers: privateSchoolRouteHeaders,
      },
      {
        source: "/schools/:schoolId/my-fees",
        headers: privateSchoolRouteHeaders,
      },
      {
        source: "/schools/:schoolId/my-fees.segments/:path*",
        headers: privateSchoolRouteHeaders,
      },
      {
        source: "/schools/:schoolId/reports",
        headers: privateSchoolRouteHeaders,
      },
      {
        source: "/schools/:schoolId/reports.segments/:path*",
        headers: privateSchoolRouteHeaders,
      },
      {
        source: "/schools/:schoolId/my-lessons",
        headers: privateSchoolRouteHeaders,
      },
      {
        // Next.js 16 can fetch independently addressed route segments.
        source: "/schools/:schoolId/my-lessons.segments/:path*",
        headers: privateSchoolRouteHeaders,
      },
      {
        source: "/schools/:schoolId/result-preparation",
        headers: privateSchoolRouteHeaders,
      },
      {
        source: "/schools/:schoolId/result-preparation.segments/:path*",
        headers: privateSchoolRouteHeaders,
      },
    ];
  },
};

export default nextConfig;
