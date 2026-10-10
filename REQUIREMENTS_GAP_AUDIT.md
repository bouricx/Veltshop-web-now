# Veltshop requirement gap audit — preliminary code-based review

Date: 2026-10-10  
Repository: `bouricx/Veltshop-web-now`  
Baseline: `main` at the start of this audit.

## Audit integrity note

The repository contains implementation/status documents but does **not** contain the original numbered 75-item master prompt. The earlier conversation summary identifies its broad subject areas, but not the exact wording of each item. This report therefore audits the code and recorded release boundaries by feature area; it must not be represented as a verified one-to-one pass/fail review of all 75 original clauses. Add the original prompt to the repository to complete that exact mapping without guessing.

## Evidence reviewed

- `IMPLEMENTATION_STATUS.md`
- `SYSTEM_COMPLETION_STATUS.md`
- `RELEASE_RUNBOOK.md`
- `src/styles.css`
- Storefront shell, store content, product grid and admin console components
- Package scripts and current CI workflow

## Feature-area matrix

| Area from the master brief | Current evidence in code/release notes | Assessment | Remaining work / verification |
|---|---|---|---|
| Branding and storefront | Thai font, black/white shop theme, brand component and storefront shell exist | Implemented in code | Compare actual deployed pages to approved brand/logo assets |
| Login, sessions and account controls | Better Auth, email/password, optional Google OAuth, session revocation and disabled-account checks documented | Implemented; provider-bound | Test real Google callback and real email delivery with owner credentials |
| Customer profile and privacy | Profile controls, personal-data export and reviewed account closure documented and tested with synthetic fixtures | Implemented with boundaries | Verify policy copy and real production customer workflow |
| Products, categories and search | Product/category editors, search and category filters in storefront | Implemented in code | Confirm all expected fields and sort/filter rules against original 75 clauses |
| Product colors and visual settings | Product card color is applied in product cards; category colors are displayed | Partial/needs UX verification | Verify every product color control is admin-only, persists, previews correctly, and has accessible contrast |
| Promotions and banners | Admin content scheduling/audience and storefront banner carousel exist | Implemented in code | Test empty, single-banner, long-title, small-screen and keyboard flows |
| Stock and digital delivery | Transactional inventory, buyer-bound delivery and private-file service are documented with automated tests | Implemented and tested in isolated environment | Validate actual production catalog and operator-supplied files; ZIP malware scanning is not provided |
| Orders, refunds, claims and warranty | Transactional order/wallet flows, claim resolution, refund/replacement controls and delivery revocation documented | Implemented and tested in isolated environment | Conduct controlled production smoke tests without risking customer funds |
| Wallet and ledger | Authoritative ledger and guarded credit/debit operations documented | Implemented in code | Amounts use whole baht; satang precision is not included; verify real production transactions |
| Top-ups and payment verification | Slip2Go verification path fails closed without configuration; TrueMoney Gift remains manual review | Partially production-ready | Real Slip2Go credentials/provider test and real reconciliation; do not claim automatic TrueMoney redemption |
| Idempotency and duplicate prevention | Database fences/request keys and transactional locks documented | Implemented in code/tests | Multi-connection PostgreSQL concurrency test remains required |
| Realtime updates and notifications | Scoped revision events/SSE and polling fallback documented | Implemented in code | Observe production event stream, reconnect behavior and cron/system history |
| Admin operations and roles | Admin console, permission model, audit events, member/wallet/order/stock/settings operations documented | Implemented in code | Review each permission against owner/staff expectations and verify all controls at narrow widths |
| Images and media management | Image decode/resize/crop, metadata stripping, media library and image editor documented | Implemented in code | Verify required dimensions/metadata shown for every image type and all requested crop/rotate/zoom/position controls |
| Backup, restore and key rotation | Encrypted backups, isolated restore verification and rotation tooling documented | Implemented in code; production DR incomplete | Configure off-site copy and perform a real production PostgreSQL recovery exercise |
| Security and operational jobs | CRON_SECRET, durable jobs, leases/retries, retention settings and immutable financial/audit records documented | Implemented with external checks outstanding | Confirm first scheduled production run, monitor logs and validate secret rotation/recovery access |
| SEO and site metadata | SEO product pages, sitemap/robots and storefront metadata documented | Implemented in code | Validate deployed canonical URLs, social preview images and crawl responses |
| Responsive layout | Prior implementation notes report desktop/390px mobile QA with no horizontal overflow | Previously tested; re-test this branch | Check common phone widths, tablet, desktop, zoom/reflow and admin data tables |
| Accessibility | Reduced-motion CSS exists; this branch adds explicit keyboard focus and mobile touch target defaults | Partial improvement | Run keyboard-only pass, screen-reader checks, contrast audit and automated axe/WCAG scan |
| Animation and motion | Staggered entrance and wheel motion exist; reduced-motion override exists | Implemented in code | Verify no motion traps, layout shift or excessive animation on low-end mobile |
| Testing and release | CI workflow covers install, typecheck, lint, tests and production build | Automated checks available | Run CI on this branch and verify deployment plus live HTTP routes after merge |
| Final report / 75-clause traceability | Status documents describe known release boundaries | Incomplete for exact master prompt | Add the original 75-item prompt, map each numbered item to file/test/evidence and mark Pass/Partial/Missing/Blocked |

## Confirmed release boundaries (do not mark as fully complete)

1. Google callback and outbound email need owner-supplied provider credentials and live tests.
2. Live Slip2Go verification/reconciliation needs real provider credentials and controlled end-to-end tests.
3. TrueMoney Gift is not automatically redeemed when no authorized API is configured.
4. Production database disaster recovery has not been exercised against the real production PostgreSQL instance.
5. The first scheduled production cron execution must be observed in system history.
6. Live HTTP/error/log checks and independent production smoke tests remain outstanding.
7. Wallet values are whole-baht precision, not satang precision.
8. The current ZIP private-file flow does not scan archive contents for malware.
9. The exact original 75 numbered clauses are not included in this repository, preventing honest clause-by-clause traceability.

## UI changes in this branch

- Improved keyboard focus visibility with a high-contrast outline.
- Improved placeholder readability and native form accent consistency.
- Applied safer touch-target defaults to storefront controls on small screens.
- Improved horizontal-scroll containment and media sizing for narrow screens.
- Added restrained hover polish without overriding admin-configured product border colors.
- Preserved reduced-motion behavior already in the stylesheet.

## Required validation after this branch

- [ ] CI: typecheck, lint, tests and production build all pass.
- [ ] Check no new lint errors or CSS/build failures.
- [ ] Keyboard-only navigation through storefront and admin.
- [ ] Test mobile widths including 320px, 360px, 390px and 430px.
- [ ] Verify product color changes persist after reload and are admin-only.
- [ ] Confirm production deployment is READY and smoke-test `/`, `/shop`, `/login`, `/shop/catalog`, and `/admin` with appropriate authentication.
- [ ] Observe a real scheduled job and perform a production backup/restore drill.
- [ ] Complete exact 75-row traceability after adding the original master prompt.
