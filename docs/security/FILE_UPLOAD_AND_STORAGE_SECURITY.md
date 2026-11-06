# File Upload and Storage Security

## Phase 9 private payment images

Only bounded PNG/JPEG raster inputs are accepted. Decode and re-encode a single
frame to PNG, reject mismatched MIME, oversized payloads/dimensions and malformed
images, and strip original metadata. No caller path, remote URL or active document
is stored. Immutable tenant/actor metadata and content hash accompany a random
private filename. Root ownership/mode, no-follow file reads, integrity verification,
current submitter/owner authorization before and after I/O, attachment disposition,
CSP sandbox and no-store headers protect retrieval. The raster decoder inspects
content; no antivirus/fraud-detection certification is claimed. Production storage,
backup and retention remain separate deployment responsibilities.

## Requirements

- Uploaded files must be scanned or inspected for malware where supported.
- Only approved file types should be accepted.
- File metadata must be tenant-aware and auditable.
- Dangerous file content and unexpected file sizes must be blocked.

## Storage rules

- Files and generated reports must be stored with scoped access.
- Uploads cannot bypass tenant isolation or approval logic.
