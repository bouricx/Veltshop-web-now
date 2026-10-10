# Veltshop — implementation checkpoint

This is an implementation checkpoint, not completion of the 75-section brief.
Source inspected: repository HEAD b25a4a4. The latest attached brief matches the first byte-for-byte.

## Existing architecture

React 19, TanStack Start server functions/file routes, Vite 8, Nitro Vercel output, Tailwind 4, Zustand.
Database: PostgreSQL through pg; Neon configured by DATABASE_URL. Development falls back to an in-memory PGLite instance.
Authentication: Better Auth email/password plus the existing Grok OAuth broker; direct Google credentials are not wired yet.
Authorization: email admin allowlist plus partially implemented roles/permissions.
Catalog/categories and payments use SQL, but wallet/order/delivery history was largely browser-local.
The old live-credit integration depended on a separate localhost slip verifier not included in this repository.

## Implemented

- Connection-bound transactions for pg and PGLite. PostgreSQL transactions use one checked-out pool client.
- Checkout locks the user's wallet then product; checks server price, funds and stock; atomically records debit, stock movement, processing order, line item, ledger and transaction.
- Per-user checkout idempotency. Reusing a key for another product is rejected.
- Successful slip payment, balance increment, ledger and financial transaction commit together.
- Official Slip2Go REST image adapter: server secret, HTTPS endpoint allowlist, no redirects, timeout, duplicate/receiver/amount/date checks, exact response validation. No configured credentials means no credit.
- Unique successful provider transaction references protect against image variations of the same transfer.
- Pending/unavailable slip verification preserves image evidence for investigation.
- Store wallet and purchase history read server data, not persisted browser values.
- Removed automatic signup demo credit and browser-generated delivery credentials from the purchase flow.
- Disabled legacy browser-only gift, wheel, box and financial adjustments until server implementations exist.
- Encrypted individual inventory with AES-256-GCM, randomized IVs, product-bound authenticated data and keyed duplicate fingerprints. Admin can add actual digital pieces; the first import explicitly switches that product from legacy quantity to individual stock.
- Atomic checkout assigns one real available piece to one completed order, or rolls back all wallet/stock/order changes. A missing/wrong encryption key fails before debit. Legacy quantity purchases remain processing.
- Buyer-only delivery retrieval, immediate delivery display and on-demand retrieval in history. Admin metadata endpoints never return plaintext/ciphertext/fingerprints.
- Product editor preserves individual counts; new products default to zero stock. A new dialog opening starts a fresh checkout key; retries in that dialog keep the key. Buyer delivery state resets when the authenticated user changes.
- Admin inventory import adds an audit entry without secret payloads.
- Updated Discord/Facebook and 24-hour service wording; removed extra contact channels from touched UI.
- Existing lint errors fixed without changing their application behavior.

## Inventory checkpoint files

- migrations/0010_digital_inventory.sql — additive inventory schema, unique piece assignment and stock mode
- src/lib/shop/inventory-crypto.server.ts — encryption and fingerprints
- src/lib/shop/inventory-service.server.ts — atomic import and owned delivery services
- src/lib/shop/inventory.ts — authenticated server-function bridges
- src/components/shop/digital-inventory-editor.tsx — admin import and stock metadata UI
- src/components/shop/product-editor.tsx / src/lib/shop/catalog.ts — authoritative individual stock mode
- Existing checkout, history, admin, tests and configuration updated for real item delivery.

## Exact files

Modified:
- src/lib/db.ts — transaction boundary
- src/lib/shop/actions.ts — authoritative checkout, wallet/order reads, atomic credit and official verification
- src/lib/shop/store.ts — remove fake balances, delivery and client financial mutations
- src/lib/shop/meta.ts — supplied contacts and service text
- src/lib/shop/topup-security.test.ts — assertions follow official verification
- src/components/shop/product-grid.tsx — server checkout, retry key, processing state
- src/components/shop/shop-shell.tsx — server wallet refresh and logout isolation
- src/routes/shop/topup.tsx — server wallet result
- src/routes/shop/history.tsx — server order history
- src/routes/shop/profile.tsx — lint fix, gift availability wording
- src/routes/admin.tsx — stop pretending local credit adjustments succeeded
- src/components/site-footer.tsx / src/routes/shop/alerts.tsx — remove extra channel
- src/lib/app-data/client.server.ts — document intentional catch to resolve lint error
- .env.example — retain prior names; document database/auth/Slip2Go configuration without secrets

Created:
- src/lib/shop/commerce.server.ts — reusable transactional financial services
- src/lib/shop/slip2go.server.ts — official provider adapter
- migrations/0009_checkout_idempotency.sql — additive keys and uniqueness constraints
- scripts/commerce.test.mjs — database integration and concurrency/rollback tests
- scripts/slip2go.test.mjs — provider contract tests with controlled test responses, never production mocks
- IMPLEMENTATION_STATUS.md — this checkpoint

## Database and deployment

Migrations 0009 and 0010 add individual stock mode, encrypted inventory records and available-item index, plus orders.idempotency_key and payments.provider_reference, plus unique indexes on user/key, ledger payment and successful provider/reference.
No production migration has been run. Existing rows are not deleted, rewritten or assigned browser balances.
Rollback: revert application before removing new columns/indexes; preserve ledger/payment data. Test a production backup restore before rollout.
No packages added. Migration/build scripts are inherited; npm run build runs db:migrate if DATABASE_URL is present.
New env: SLIP2GO_VERIFY_URL, SLIP2GO_API_SECRET, INVENTORY_ENCRYPTION_KEY. The inventory key must be 32 random bytes encoded as 64 hexadecimal characters, generated and stored in hosting secrets. Back it up securely: replacing or losing it prevents retrieval of existing pieces. Key rotation/re-encryption is not yet implemented. Existing DATABASE_URL/BETTER_AUTH_URL/BETTER_AUTH_SECRET/ADMIN_EMAILS and broker settings remain required as appropriate.
Official references: https://slip2go.com/guide/rest-api/image , https://slip2go.com/guide/authentication , https://slip2go.com/guide/response .

## Validation

24 focused tests pass: checkout concurrency, retries, insufficient balance, atomic rollback, duplicate slips, actual-piece purchase races, buyer isolation, key failure and authenticated encryption, provider conditions/configuration, existing slip/QR security tests.
Typecheck passes. Production build passes; migration skipped because no DATABASE_URL is configured.
Lint: zero errors, 11 existing warnings.
Full npm test is not green: template tests require missing .grok/skills/og files and assume an auth-disabled template, inconsistent with this app's existing auth-on configuration.
Browser QA incomplete: no installed Chromium, browser download failed; local Vite also hit uv_interface_addresses restrictions. Do not treat compile success as E2E/UI verification.
PGLite integration tests verify transaction semantics locally; actual PostgreSQL concurrency must still be tested in staging.
No live Slip2Go request, payment, production database write or deployment was performed.

## Remaining engineering work

The brief is still incomplete. In particular: inventory bulk import/disable workflows and encryption key rotation; asynchronous delivery jobs/retries and expiring reservations; complete server RBAC/admin features/audit coverage; direct Google OAuth and session controls; gift codes/promotions; claims/refunds; real dashboard/users/customer exports; centralized image decode/crop/resize/storage/dimension settings; rate limits; durable reconciliation/webhooks/queue; backups/restore verification; site settings and maintenance; privacy/retention; full staging E2E/security/production readiness checks.
Amounts still use the existing whole-baht integer schema. Satang support and percentage-fee rounding require a separate carefully reviewed migration.
Older HANDOFF.md and DEPLOY_STATUS.md describe the legacy slip verifier. This checkpoint supersedes those instructions for wallet credit, but does not attest to the current deployed site's state.

## Owner configuration needed

Staging/production database access, actual Slip2Go endpoint/secret and approved receiver configuration, OAuth credentials, hosting access and hosting secrets. GitHub write access is verified; draft PR #1 contains this checkpoint. Supply secrets through the service's secret settings, not chat or source files.
