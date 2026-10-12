# Navigation and Dashboards

## Navigation principles

- Navigation must reflect permissions rather than just a static menu.
- The home workspace displays all active school memberships, but offers the existing academic school-detail link only when the current `academic:read` school-level policy permits it. A restricted-membership label replaces a link to an inaccessible page. This is a presentation hint only: the destination must still reauthenticate and reauthorize each request. The change does not grant parents, students, or teachers new academic permissions.
- Dashboards must be tenant-scoped and respect section/class/subject access.
- Empty, loading, and error states must be explicit.
- Dashboard widgets must not expose data outside the user’s authorization.

## School academic setup workspace (authored, pending validation)

`/schools/{schoolId}/setup` is a server-rendered, restricted School Administrator / School Super Admin workspace linked from the existing school details page only when `school:configure` allows it. The server reauthenticates with Better Auth, resolves the current school membership and repeats active same-school identity/role constraints on each selected collection query. The view lists up to 100 sessions, terms, classes, and subjects separately; a client editor submits strictly validated create requests through the existing school-owned API, surfaces safe error states and refreshes on confirmed success. No public guardian, teacher, or platform-only access follows from the navigation link. Keyboard label and error-status semantics are authored but require real browser accessibility and HTTP-transport validation.

This setup view supports draft sessions and terms plus class/subject creation; it does **not** activate periods, publish academic results, edit historical records or change school approval flows.

## Platform Super Admin dashboard

- Tenant status summary
- Subscription and billing overview
- Platform health and audit events
- Retention and support-view tasks

## School Super Admin dashboard

- School configuration summary
- Enrollment and academic-status overview
- Results publication queue
- Staff permission overview
- School Trash and retention information

## School administrator dashboard

- Day-to-day class and enrollment status
- Fees, attendances, and school notices
- Workflow queues

## HM dashboard

- Primary section overview
- Attendance approvals
- Lesson-note approvals
- Result-sheet review queue

## Principal dashboard

- Secondary section overview
- Teacher assignment oversight
- Timetables, assessments, and result approvals

## Form Teacher dashboard

- Assigned class summary
- Attendance submission
- Class notices and academic tasks

## Subject Teacher dashboard

- Assigned classes and subjects
- Assessment and score submission areas
- Lesson-note planning and approval status

## Parent dashboard

- Linked children summary
- Attendance, fees, notices, and official report cards where authorized
- Notification center

## Student dashboard

- Assessments and released notes
- Assignments and announcements
- Timetable and academic calendar
- Official report cards when policy allows

## Accessibility expectations

- Keyboard navigation and visible focus states
- Color contrast and readable typography
- Mobile-first layouts for attendance, notices, and reports
- Error states and confirmation for critical actions
