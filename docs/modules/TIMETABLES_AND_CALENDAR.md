# Timetables and Academic Calendar

## Scope

Academic calendar, timetable management, class schedules, teacher availability, and conflict detection.

## Requirements

- HM controls primary timetables within scope.
- Principal controls secondary timetables within scope.
- Class and teacher schedules must remain consistent.
- Conflicts must be validated on subject, teacher, room, class, and time dimensions.

## Implementation checkpoint and remaining section authority (2026-10-12)

The current Phase 5 development candidate provides an **administrator-only** timetable room/slot/cancellation API and a school-administration weekly timetable workspace. It uses same-school `school:configure` authority (School Administrator / School Super Admin), an ACTIVE exact teacher/class/subject/session assignment and academic term, and PostgreSQL `btree_gist` exclusions for teacher, class and room collisions on half-open, school-local weekday/minute intervals. Cancellation preserves the slot and append-only audit history. It does not introduce any pupil timetable API, automatic timetable publication or universal bell schedule.

**HM and Principal section-scoped timetable control remains a required feature in this canonical specification, not an accepted omission.** Because the current foundation has not yet implemented verified school-owned Section/class ownership, the new APIs do not grant an HM or Principal unbounded school-wide scheduling permissions. The next section-aware implementation must scope staff to the exact active primary/secondary section, relevant class, session and timetable resources and add real cross-section negative tests before enabling these roles. The same restriction applies to future class/lesson data routes. Staff teaching allocations and room/teacher conflicts remain independently enforced. The new migration, HTTP/browser tests and cross-section access checks are **not yet verified** on the owner-run disposable local database.

## Audit expectations

- Timetable changes are auditable.
- Historical schedules remain preserved when changes occur.
