# Veltshop 0.4.0 system completion

## Implemented and verified locally

- Private digital-file inventory: PDF, ZIP and UTF-8 TXT, maximum 2 MB per file. Files are authenticated-encrypted with product/file-bound data, stored in PostgreSQL, and served as attachments only to the current buyer of a completed order. Refunds and replacements revoke the original file. Public media never holds the paid file. ZIP content is not antivirus-scanned; operators must supply trusted files.
- Personal-data JSON export omits password hashes, session tokens, provider credentials and other users. Exports beyond 10,000 rows per section refuse incomplete output. Customers request account closure; super administrators review with reasons and confirmation. Privileged accounts, nonzero balances, pending payments and open claims block approval. Approval anonymizes the account, removes login methods/sessions, and disables it; financial records and necessary review evidence remain. This is reviewed closure, not unrestricted physical deletion of financial records.
- SSE sends scoped revision counters, not customer data. Database writes produce commit-bound invalidations; the stream samples every five seconds and reconnects after 25 seconds. Pages refresh authoritative data on invalidation. Existing 15-second polling remains available if streaming is interrupted. Operational revision rows expire after seven days.
- GET and POST /api/jobs/run require a generated CRON_SECRET. Daily Vercel schedule is 02:00 UTC (09:00 Thailand; Hobby scheduling may vary within the hour). The runner processes up to ten durable jobs, logs success/failure, schedules encrypted backup every 24 hours, and cleans expired sessions/rate-limit rows. Read notification/login/successful-job retention is opt-in from settings (0 means keep). Financial/audit records are never pruned by this runner.
- Backup effects and job completion share the lease-guarded transaction. Stale workers cannot write duplicate backup records. Recovery and key rotation support new private files and privacy/system records.
- Production-only inventory encryption key, backup encryption key and cron secret were generated and added through Vercel Secrets. They are not in git, client output or reports. Preserve the hosting secrets and recovery access; old encrypted backup files require their original keys. Off-site disaster recovery remains an operator responsibility.

## Validation

- Full test suite: 274 passed, 4 skipped, 0 failed, including six system completion cases and private-file restoration. Slip/QR security: 12 passed separately. Aggregate unique passing cases: 286.
- Typecheck and production build pass. Lint has zero errors and two existing React refresh warnings.
- Compiled production browser QA: desktop/mobile rendering; registration; authorized credit; product/stock; purchase/delivery; claim/refund; SSE change; private-file purchase/download and anonymous denial; private-file refund revocation; personal-data export; encrypted backup creation and isolated restore verification all pass. QA uses an isolated embedded database and synthetic fixture accounts, never production customer data.

## Release and external boundaries

The production release is verified separately after deployment. Daily cron is configured, but its first scheduled execution must be observed in the system history. Locally verified recovery is not a real production PostgreSQL disaster-recovery exercise.

Google callback, email sending and live Slip2Go verification require owner-supplied provider credentials. Signed provider webhooks cannot be implemented against an invented contract; the existing synchronous verification/reconciliation flow stays authoritative until an official event/signature specification is available. TrueMoney Gift remains manual/pending as required when no authorized API is configured. No payment is credited using mock verification.

Wallet amounts still use whole baht; a satang-precision conversion is not included. No claim is made that every detailed clause of the original 75-section brief has been independently audited or production-tested.

## Changed files and schema

Additive migration 0012 creates private_files, privacy_requests, system_runs and realtime_revisions, with indexes and revision triggers. No existing production data is removed by migration.

New services/routes/components: src/lib/shop/private-files-service.server.ts, private-files.ts, privacy-service.server.ts, privacy.ts, system-runner.server.ts, realtime-client.ts; src/routes/api/files/$id.ts; src/routes/api/shop-events.ts; src/components/shop/privacy-controls.tsx; scripts/system-completion.test.mjs; vercel.json.

Existing catalog/history/inventory/admin/settings/runtime components, backup/key-rotation tools, job runner, .env.example, package/version metadata and generated route tree are updated to integrate these services. No new dependency is added.
