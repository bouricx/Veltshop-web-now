# VELTSHOP deploy status (box-local)

## Primary production URL (lasting)
- **https://veltshop-website.vercel.app** — Vercel project `veltshop-website`
- Do **not** treat `https://veltshop.vercel.app` as primary (sibling from mis-link)

## Target (lasting)
- Website: **Vercel** project `veltshop-website` (Nitro preset)
- DB: **Neon Postgres** via `DATABASE_URL` (required for Better Auth + wallet; PGLite is preview-only / not durable on serverless)
- Slip API: reachable as `SLIP_VERIFY_URL` (interim tunnel OK if labeled)
- Auth base: Production `BETTER_AUTH_URL` must be exactly `https://veltshop-website.vercel.app` (no trailing slash)

## Prepared on box
- `.env` + `.env.production.local`: ADMIN_EMAIL(S), BETTER_AUTH_SECRET, SLIP_VERIFY_URL set (secrets not documented here)
- `scripts/deploy-vercel-after-login.sh` — deploy helper
- `.grok/app-env.json` has `deploy.database: true`
- Auth ON; PromptPay **0928160016**; credit only after server-side slip verify
- Interim tunnels: `/tmp/VELTSHOP_INTERIM_TUNNELS.txt` and `/workspace/veltshop-ops/*-public-url.txt`
- `.vercel/project.json` linked to `veltshop-website`

## Tooling
| Tool | Status |
|------|--------|
| `npx` / Node 22 | OK |
| `npx vercel` 59.x | OK, logged in as wavezazaezeaea-4527 |
| `gh` | installed (auth may vary) |
| `npx cloudflared` | OK (quick tunnels) |
| `npx neonctl` | available |
| system `docker` / `cloudflared` | **missing** |

## Production checklist
1. Confirm Production env includes `BETTER_AUTH_URL=https://veltshop-website.vercel.app`
2. `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ADMIN_EMAIL` / `ADMIN_EMAILS`, `SLIP_VERIFY_URL` set on Vercel Production
3. Smoke: `/shop`, `/login`, `/shop/catalog` → HTTP 200 on primary URL

## Interim public URLs (NOT lasting)
See `/tmp/VELTSHOP_INTERIM_TUNNELS.txt` — shop :8080 + slip :8787 trycloudflare quick tunnels.
