# File Upload and Storage Security

## Requirements

- Uploaded files must be scanned or inspected for malware where supported.
- Only approved file types should be accepted.
- File metadata must be tenant-aware and auditable.
- Dangerous file content and unexpected file sizes must be blocked.

## Storage rules

- Files and generated reports must be stored with scoped access.
- Uploads cannot bypass tenant isolation or approval logic.
