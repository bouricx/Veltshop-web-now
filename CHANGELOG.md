# Changelog

## 0.3.0

- Replace browser financial state with authoritative wallet, inventory, checkout, payment evidence and ledger transactions.
- Add protected operational administration: members/roles, refunds/replacements, claims, gifts, coupons, content, media, exports/imports, jobs, reconciliation, backups and settings.
- Add native Google configuration, optional password-reset/verification email, session revocation, disabled-account checks, durable login history and rate limits.
- Add encrypted backup verification/recovery and inventory-key rotation operator tools.
- Replace invented storefront activity with database statistics; add real reward campaigns, owned delivery, product metadata/SEO and responsive Thai UI with bundled fonts.
- Keep successful delivery dialogs mounted after catalog refresh and stabilize authenticated user identity so wallet effects do not continually reset balances.
- Preserve existing platform authentication/PWA/preview integration and package embedded runtime assets for production previews.

On 2026-10-10, patched source a14ad56 was deployed to production, migrations through 0011 applied, and the requested existing owner account received audited super_admin access. Live provider payment, OAuth callback and email delivery remain unverified. See RELEASE_RUNBOOK.md and IMPLEMENTATION_STATUS.md for validation and external configuration requirements.
