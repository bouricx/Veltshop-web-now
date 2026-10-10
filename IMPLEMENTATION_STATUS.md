> Current operational additions: see SYSTEM_COMPLETION_STATUS.md for release 0.4.0. The historical 0.3.0 boundaries below are superseded where explicitly described there.

# Veltshop 0.3.0 implementation status

This release extends the original repository and the supplied Thai brief. It is a reviewable implementation, not an assertion that every production requirement in the 75-section brief is deployed or independently verified. Source baseline: b25a4a4. The PR remains on a development branch.

## Implemented behavior

- Authoritative PostgreSQL wallet, order, ledger, checkout and payment records. Connection-bound transactions, locks, uniqueness fences and request keys prevent repeated debits/credits and double-selling. Browser state cannot grant credit or invent delivery.
- AES-256-GCM inventory and delivery overrides with product-bound authenticated data, random IVs and keyed duplicate detection. Actual pieces are assigned atomically; wrong keys or missing stock roll back purchases. Only the buyer of a completed order can retrieve delivery.
- Official Slip2Go REST verification through a provider interface, server-held credentials, HTTPS allowlist, receiver/exact amount/reference/date checks and timeout. Missing credentials fail closed. Durable proof supports reconciliation; global bank-reference uniqueness spans manual and automatic approvals. TrueMoney gift URLs are validated/encrypted for manual review only.
- Protected administration for catalog/categories, actual stock, members/roles, wallet adjustments, orders/refunds/replacements, claims, gifts, coupons, content schedules/audiences, media, transactions/audit, sessions/login history, jobs, backups, settings and payment settings. Search, filters, pagination and exports use SQL. Sensitive actions require permissions and reasons and append audit records; financial/audit history is immutable.
- Claims enforce ownership and warranty policy. Refunds append credit once and revoke delivery without automatically relisting sold inventory. Manual payment approval requires actual evidence amount and a unique reference.
- Gift redemptions and coupons enforce database usage limits. Paid wheel/box campaigns use server cryptographic randomness, wallet transactions, daily limits and idempotency; campaigns are initially inactive. No browser-generated prizes or fake payment approvals.
- Validated JSON batch imports with all-or-nothing transactions and retry keys; blank templates and CSV product exports; secret inventory metadata excluded from exports.
- Native email/password and optional direct Google OAuth, optional Resend reset/verification messages, account-linking verification, database rate limits, durable login history, revoked sessions and disabled-account checks. Existing broker/PWA/platform auth wiring is retained. Verified root allowlist and an operator-only existing-account bootstrap CLI are available.
- Real storefront statistics and purchase feed, owned history, notifications, profile controls, maintenance flags, terms/privacy/refund settings, SEO product pages, sitemap/robots, and bundled Thai fonts. Wallet user identity is stable; refresh no longer unmounts the purchased delivery dialog.
- Sharp decodes valid image formats, bounds dimensions/size, strips metadata, crops/resizes and creates thumbnails. PostgreSQL persists processed public media; sensitive delivery is separate.
- Durable database jobs with leases/retry/dead-letter handling; encrypted snapshot creation/download, isolated restore verification, separate empty-recovery restore CLI and transactional inventory-key rotation CLI. Runtime packaging includes PGLite WASM/data assets for embedded production previews.

## Database and configuration

Additive migrations 0009–0011 retain existing shop data. 0011 adds operational tables, permissions, reference fences, immutable history triggers, category/product metadata and encrypted gift evidence. Production migrations through 0011 applied during the owner-requested administrator repair on 2026-10-10. Production must use durable PostgreSQL; the embedded preview database is ephemeral.

New dependencies: sharp and bundled Noto Sans Thai. Package version: 0.3.0. Secrets are documented in `.env.example`; none are included in source. See RELEASE_RUNBOOK.md for exact setup, first administrator, jobs, recovery, rotation, staging tests and rollback procedures.

## Validation

- Full npm test: 268 pass, 0 fail, 4 skip. The four skipped checks require absent original platform skill manuals; runtime/financial tests still execute.
- Additional slip/QR security tests: 12 pass, 0 fail. Combined: 280 passing tests.
- Typecheck passes. Lint: 0 errors, 2 React refresh warnings. Production build succeeds; external PostgreSQL migration is skipped because DATABASE_URL is absent. Diff whitespace check passes.
- Database integration exercises stock races, request retries, insufficient funds, crypto failure, buyer isolation, coupon/gift limits, immutable records, manual payment reference reuse, claims/replacement/refund revocation, job leasing/retry, actual image decoding, backup authentication/restore rejection and import rollback.
- Browser QA uses the compiled production application and native cookie auth in an isolated embedded database. Desktop and 390px mobile rendering inspected; no mobile horizontal overflow. Signup → administrator credit adjustment → product and actual stock creation → purchase → owned delivery display → claim creation → refund and refunded status all pass. The administrator fixture exists only in the external QA harness, not production source.

## External and deferred requirements

Production deployment a14ad56b33825776536f07f13175a5d9613dab88 is READY, migrations through 0011 applied, and the requested existing owner account was granted super_admin with an audit event. No live bank/provider transaction, real Google callback or real email send was performed. Actual multi-connection PostgreSQL concurrency, live provider failure/reconciliation and real PostgreSQL disaster recovery require staging credentials and hosting setup.

There is no signed provider webhook contract/receiver, automatic TrueMoney redemption, satang-precision migration, retention purge or protected binary file-hosting subsystem in this release. Public image storage must not hold paid private files. Encrypted delivery can contain owner-supplied file links; the external host's access controls remain its responsibility. Database backup/media storage needs monitoring and off-site copies configured by the operator. Polling updates run every 15 seconds rather than claiming push delivery. Older HANDOFF.md/DEPLOY_STATUS.md describe a legacy localhost slip verifier; this status and the release runbook supersede those payment instructions.

These limits are explicit release boundaries, not claims of finished production readiness.

## Exact release files

The following files change in this release relative to the preceding inventory checkpoint.

| File                                               | Area                          |
| -------------------------------------------------- | ----------------------------- |
| `.env.example`                                     | Configuration/runtime         |
| `CHANGELOG.md`                                     | Operations documentation      |
| `IMPLEMENTATION_STATUS.md`                         | Operations documentation      |
| `RELEASE_RUNBOOK.md`                               | Operations documentation      |
| `migrations/0011_shop_operations.sql`              | Database migration            |
| `package-lock.json`                                | Configuration/runtime         |
| `package.json`                                     | Configuration/runtime         |
| `scripts/brand-check.test.mjs`                     | Verification/operator tooling |
| `scripts/check-auth-invariant.test.mjs`            | Verification/operator tooling |
| `scripts/commerce.test.mjs`                        | Verification/operator tooling |
| `scripts/grant-admin.mjs`                          | Verification/operator tooling |
| `scripts/operations.test.mjs`                      | Verification/operator tooling |
| `scripts/package-runtime-assets.mjs`               | Verification/operator tooling |
| `scripts/restore-backup.mjs`                       | Verification/operator tooling |
| `scripts/rotate-inventory-key.mjs`                 | Verification/operator tooling |
| `scripts/with-app-env.test.mjs`                    | Verification/operator tooling |
| `scripts/write-atomic.test.mjs`                    | Verification/operator tooling |
| `src/components/brand-mark.tsx`                    | UI/routes                     |
| `src/components/shop/admin-console.tsx`            | UI/routes                     |
| `src/components/shop/category-editor.tsx`          | UI/routes                     |
| `src/components/shop/data-import.tsx`              | UI/routes                     |
| `src/components/shop/digital-inventory-editor.tsx` | UI/routes                     |
| `src/components/shop/flash-sale.tsx`               | UI/routes                     |
| `src/components/shop/image-editor.tsx`             | UI/routes                     |
| `src/components/shop/live-feed.tsx`                | UI/routes                     |
| `src/components/shop/product-editor.tsx`           | UI/routes                     |
| `src/components/shop/product-grid.tsx`             | UI/routes                     |
| `src/components/shop/reward-panel.tsx`             | UI/routes                     |
| `src/components/shop/shop-shell.tsx`               | UI/routes                     |
| `src/components/shop/store-content.tsx`            | UI/routes                     |
| `src/components/site-footer.tsx`                   | UI/routes                     |
| `src/lib/auth/email.server.ts`                     | Server/client services        |
| `src/lib/auth/middleware.ts`                       | Server/client services        |
| `src/lib/auth/server.ts`                           | Server/client services        |
| `src/lib/auth/use-current-user.ts`                 | Server/client services        |
| `src/lib/auth/verify.server.ts`                    | Server/client services        |
| `src/lib/error-component.tsx`                      | Server/client services        |
| `src/lib/shop/access.ts`                           | Server/client services        |
| `src/lib/shop/actions.ts`                          | Server/client services        |
| `src/lib/shop/admin-data.ts`                       | Server/client services        |
| `src/lib/shop/admin-gate.ts`                       | Server/client services        |
| `src/lib/shop/backup-service.server.ts`            | Server/client services        |
| `src/lib/shop/backup-verification.server.ts`       | Server/client services        |
| `src/lib/shop/backups.ts`                          | Server/client services        |
| `src/lib/shop/catalog.ts`                          | Server/client services        |
| `src/lib/shop/commerce.server.ts`                  | Server/client services        |
| `src/lib/shop/import-service.server.ts`            | Server/client services        |
| `src/lib/shop/imports.ts`                          | Server/client services        |
| `src/lib/shop/inventory-service.server.ts`         | Server/client services        |
| `src/lib/shop/inventory.ts`                        | Server/client services        |
| `src/lib/shop/jobs-service.server.ts`              | Server/client services        |
| `src/lib/shop/jobs.ts`                             | Server/client services        |
| `src/lib/shop/media-service.server.ts`             | Server/client services        |
| `src/lib/shop/media.ts`                            | Server/client services        |
| `src/lib/shop/operations-service.server.ts`        | Server/client services        |
| `src/lib/shop/operations.ts`                       | Server/client services        |
| `src/lib/shop/payment-providers.server.ts`         | Server/client services        |
| `src/lib/shop/permissions.server.ts`               | Server/client services        |
| `src/lib/shop/promptpay-qr.ts`                     | Server/client services        |
| `src/lib/shop/require-admin.server.ts`             | Server/client services        |
| `src/lib/shop/rewards-service.server.ts`           | Server/client services        |
| `src/lib/shop/rewards.ts`                          | Server/client services        |
| `src/lib/shop/role-actions.server.ts`              | Server/client services        |
| `src/lib/shop/settings-schema.ts`                  | Server/client services        |
| `src/lib/shop/site-state.tsx`                      | Server/client services        |
| `src/lib/shop/slip-verify-upstream.server.ts`      | Server/client services        |
| `src/lib/shop/slip-verify.ts`                      | Server/client services        |
| `src/lib/shop/store.ts`                            | Server/client services        |
| `src/lib/shop/storefront.ts`                       | Server/client services        |
| `src/lib/shop/topup-security.test.ts`              | Server/client services        |
| `src/lib/shop/validation.ts`                       | Server/client services        |
| `src/routeTree.gen.ts`                             | Configuration/runtime         |
| `src/routes/__root.tsx`                            | UI/routes                     |
| `src/routes/admin.tsx`                             | UI/routes                     |
| `src/routes/admin/payments/reconciliation.tsx`     | UI/routes                     |
| `src/routes/admin/topups.tsx`                      | UI/routes                     |
| `src/routes/api/auth/$.ts`                         | UI/routes                     |
| `src/routes/api/jobs/run.ts`                       | UI/routes                     |
| `src/routes/api/media/$id.ts`                      | UI/routes                     |
| `src/routes/api/slip/verify.ts`                    | UI/routes                     |
| `src/routes/login.tsx`                             | UI/routes                     |
| `src/routes/reset-password.tsx`                    | UI/routes                     |
| `src/routes/robots[.]txt.ts`                       | UI/routes                     |
| `src/routes/shop/alerts.tsx`                       | UI/routes                     |
| `src/routes/shop/box.tsx`                          | UI/routes                     |
| `src/routes/shop/catalog.tsx`                      | UI/routes                     |
| `src/routes/shop/claims.tsx`                       | UI/routes                     |
| `src/routes/shop/index.tsx`                        | UI/routes                     |
| `src/routes/shop/privacy.tsx`                      | UI/routes                     |
| `src/routes/shop/product/$id.tsx`                  | UI/routes                     |
| `src/routes/shop/profile.tsx`                      | UI/routes                     |
| `src/routes/shop/settings.tsx`                     | UI/routes                     |
| `src/routes/shop/topup.tsx`                        | UI/routes                     |
| `src/routes/shop/wheel.tsx`                        | UI/routes                     |
| `src/routes/sitemap[.]xml.ts`                      | UI/routes                     |
| `src/styles.css`                                   | Configuration/runtime         |
| `startup.sh`                                       | Configuration/runtime         |
