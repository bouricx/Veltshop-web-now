# Veltshop 0.3.0 release runbook

## Configure before taking money

Use Node 24, `npm ci`, a durable PostgreSQL database, and hosting secrets from `.env.example`. The embedded PGLite preview database is ephemeral and is not suitable for a live shop. Do not place secrets in chat, GitHub, browser settings, or public images.

Required: `DATABASE_URL`, canonical HTTPS `BETTER_AUTH_URL`, strong `BETTER_AUTH_SECRET`, independent 64-hex-character `INVENTORY_ENCRYPTION_KEY` and `BACKUP_ENCRYPTION_KEY`. Preserve both encryption keys securely with the backups. Missing inventory credentials prevent delivery; missing payment credentials never authorize automatic credit.

Optional services: official Slip2Go HTTPS image-verification endpoint and API secret; Google OAuth client and `/api/auth/callback/google`; Resend API key and verified `EMAIL_FROM`; existing Grok broker credentials. The server checks configured services and feature flags. TrueMoney gift submissions are encrypted requests for manual review, not automatic gift redemption. There is no production payment webhook receiver or undocumented provider-signature bypass.

Set `PROMPTPAY_RECEIVER` to the approved 10- or 13-digit receiver and keep admin payment settings consistent with that environment value. Confirm the bank account/receiver, fee, minimum and maximum top-up settings before enabling the payment method. Whole-baht integer amounts and rounding are inherited; satang precision is not implemented.

## First administrator

1. Run `npm run db:migrate` against staging. This applies migrations through 0011; backup the existing production database before any production migration.
2. Register the owner's account through the normal login page. Verify its identity out of band before granting privileges.
3. An authorized database operator can run `node scripts/grant-admin.mjs owner@example.com --grant-existing-account` with the correct `DATABASE_URL`. It grants only an existing account, writes an audit event, and does not create a user or password. Check the destination database first.
4. Sign in normally and open `/admin`. Manage subsequent roles through the protected roles controls. `ADMIN_EMAILS` is an optional root backstop for verified email addresses; an unverified signup using that address does not gain root access.

## Build and staging validation

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Build includes migration when `DATABASE_URL` is configured and packages the embedded database's WASM assets privately. Deploy the complete Vercel/Nitro output, including native sharp dependencies. Existing startup/dev/preview entry points are retained.

On a separate staging PostgreSQL database, test simultaneous purchases of the last inventory piece using separate connections; repeat requests and verify one debit/order/delivery; prove customer A cannot read customer B's delivery or claim. Check insufficient balance, wrong encryption keys, refund retries, coupon/gift limits, and disabled-account/session revocation.

Use authorized provider test transactions to verify receiver, amount, duplicate bank reference, expired/wrong slip, provider timeout, retry and reconciliation. For manual payment approval, staff must inspect actual evidence and supply the actual verified amount and unique transfer reference. Client-entered amounts alone never authorize credit. Verify Google callbacks and real email delivery after configuring those services. These external checks were not performed in this workspace.

## Jobs and backups

Configure an external scheduler to POST `/api/jobs/run` with `Authorization: Bearer CRON_SECRET` at a suitable interval. Keep the secret out of URLs. Jobs use database leases, bounded retries and dead-letter status; authorized staff can inspect and retry failures. `BACKUP_EVERY_HOURS` controls automatic snapshot scheduling when the worker runs. Monitor failures and database storage; image and encrypted backup bytes are stored durably in PostgreSQL, not ephemeral local disk.

Create/download an encrypted backup through the protected backups panel and run its isolated verification. Also perform an independent recovery drill against real PostgreSQL:

1. Create a separate empty recovery database and apply the same migrations using that database's URL.
2. Run `node --experimental-strip-types scripts/restore-backup.mjs snapshot.velt` with `RESTORE_DATABASE_URL` pointing to recovery and the snapshot's `BACKUP_ENCRYPTION_KEY`. Keep `DATABASE_URL` set to the source URL so the explicit same-target guard works.
3. The tool authenticates the ciphertext, validates permitted tables and refuses a populated recovery database. Inspect users, balances, ledgers, inventory, orders and deliveries before any manual cutover. Never restore over the running shop.

## Inventory key rotation

Read `scripts/rotate-inventory-key.mjs` usage. Enable maintenance and pause all workers/writes. Supply the current and next independent encryption keys through the documented environment variables and run with `--rotate`. The script locks and re-encrypts inventory, delivery overrides, pending gift evidence and encrypted settings in one transaction. Only after commit update the hosting inventory key and restart all application instances. Preserve old keys for older snapshots. Test this process in staging first; it has not been executed against production here.

## Operations and rollback

Upload ordinary product/category/banner/avatar images through the media editor; format, dimensions, size, crop and metadata are processed on the server. These media URLs are public. Do not upload customer credentials or private paid files there. Paid delivery text/links are encrypted and revealed only to the order owner; any external file URL's access policy remains the storage provider's responsibility.

Imports accept validated JSON arrays of 1–200 rows. Download blank templates, fill valid category/product identifiers, and review before confirming. The entire batch rolls back on invalid data or duplicate identifiers. Exports escape spreadsheet formulas and exclude inventory secrets.

Use maintenance mode before production changes. Keep financial records and audit events: immutable triggers deliberately reject edit/delete. Refunds append credit and revoke order delivery; sold pieces are not automatically relisted. Revert application artifacts if needed while retaining additive schema and transaction data. Do not drop migrations or reconstruct balances from browser state.

Configure retention, off-site backup copies, database monitoring and incident procedures for the actual deployment. A retention purge, satang migration, provider webhook integration and privately hosted binary deliveries are separate work, not claimed by this release.

## 0.4.0 operations

The native Vercel daily cron calls GET /api/jobs/run at 02:00 UTC (09:00 Thailand). POST remains compatible with an authorized external scheduler. CRON_SECRET is server-only. Inspect the system panel for execution history; manual processing uses the same runner. BACKUP_EVERY_HOURS=24 schedules daily encrypted snapshots. Download encrypted backups to independent storage and preserve original encryption keys before rotating or removing hosting resources.

Private PDF/ZIP/TXT delivery is limited to 2 MB per item. Upload it in the stock editor; it becomes one real stock item. Paid files are served from /api/files only to their buyer, with no caching. Refund/replacement revokes original access. Source files must be trusted; ZIP contents are not malware-scanned.

Privacy exports and account-closure requests are on /shop/privacy; administrators review requests from the privacy tab. Closure retains financial/audit evidence and refuses privileged accounts, balances and open cases. Nonfinancial retention settings default to zero (keep); choose the actual store policy before enabling cleanup.
