# Notifications and Events

## Notification model

Notifications are first-class and must be actionable, relevant, and tenant-aware.

## Required event categories

- Attendance awaiting approval
- Attendance approved or rejected
- Lesson notes awaiting review
- Lessons released to a class
- Result sheets awaiting review
- Report cards published
- Parent view acknowledgment events
- Fee receipt submission and verification results
- Subscription expiry or tenant status changes
- Permission changes
- Trash expiration and restoration outcomes

## Delivery model

- Default delivery: in-app notifications
- Optional delivery: email, SMS, push, or WhatsApp, subject to explicit approval and provider integration
- Each event must include actor, target, tenant scope, and action metadata

## Security and privacy constraints

- Do not leak student result data, payment details, or another tenant’s information in notification text.
- Notifications must be deduplicated and support retry semantics.
- Delivery state and failure history must be retained in audit-friendly data structures.
