# 0.5.0 — clean storefront and remaining admin operations

- Clean surfaces, product palettes with contrasting text, deliberate/reduced-motion animation, responsive navigation and accessibility labels.
- Descriptions/icons and separately persisted card/border/accent/badge colors; unified image editor, re-edit existing media, formats/dimensions/thumbnail/optimization settings.
- Storefront multi-word search, sort, available filter and pagination; real featured products and truthful empty/error states.
- Thai calendar reports: today, month, all time and inclusive custom date ranges, recent orders/topups.
- Category gift selection with transactional validation and immutable retry identity; edit gift limits/expiry/name.
- Persistent admin notification inbox with per-admin read state; SQL search/date/status/pagination for media/privacy/backups.
- Merge with main406d63f preserves privilege-grant security and full product artwork/mobile sizing fixes.
- Additive migrations0013/0014; encrypted backup/restore covers new events and suppresses notification replay during restore.
- Original 75-section master prompt and a clause-by-clause review added; provider/live verification boundaries remain explicit.

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

## 0.4.0 — System operations completion

- Encrypted private PDF/ZIP/TXT inventory with buyer-only attachment downloads (2 MB), refund/replacement revocation, retry protection and backup/key-rotation support.
- Customer personal-data exports and reviewed account closure, preserving financial evidence and blocking privileged accounts, remaining wallet funds and open cases.
- SSE invalidations for catalog, wallet, order/payment and administration changes, with polling fallback and bounded connections.
- Authenticated GET/POST maintenance runner, daily Vercel cron, execution history and opt-in nonfinancial retention.
- Backup job effects and lease completion commit atomically; new system records are included in isolated restoration.
