# VELTSHOP — handoff

## Primary production URL

- **https://veltshop-website.vercel.app** (Vercel project `veltshop-website`)
- Do **not** use `https://veltshop.vercel.app` — that was a sibling project from a mis-link; not the lasting primary.
- Display brand remains **VeltShop.com**.

## Auth (enabled)

- `.grok/app-env.json`: no `VITE_AUTH_ENABLED=false` (auth on)
- `migrations/0001_auth.sql` applied path present
- `emailAndPasswordEnabled = true` (Better Auth hashes passwords; no plaintext)
- Customer: `/login` register or sign-in (email/password or Google/X)
- Admin: sign in with an email listed in `ADMIN_EMAILS` / `ADMIN_EMAIL`, then open `/admin`

## PromptPay

**0928160016** (shop destination / shared verifier)

## Slip verification (shared service)

- Shared API: `http://127.0.0.1:8787` (`/workspace/veltshop-discord-topup`)
- Website proxy: `POST /api/slip/verify` → creates order if needed → `POST :8787/v1/verify-slip`
- Wallet credit: **`topupWithSlip`** (preferred) or `processPayment` slip+image — server calls `:8787` itself; never trusts client `slipVerified` / `verifiedAmount`
- `/api/slip/verify` is read-only (diagnostics) — it does not grant credit
- `auto_release=false` on 8787 — codes are never auto-returned from verify
- PromptPay / `receive_account` must stay **0928160016** (aligned with hardcoded verifier); do not use Slip2Go/Thunder for live credit

### Test curls

```bash
curl -s http://127.0.0.1:8787/health
curl -s http://127.0.0.1:8080/api/slip/verify

# Via website proxy (recommended for browser)
curl -sS -X POST http://127.0.0.1:8080/api/slip/verify \
  -F amount=100 \
  -F file=@/workspace/veltshop-discord-topup/fixtures/slip_ok_dashed.png

# Direct shared API (needs order first)
OID=$(curl -sS -X POST http://127.0.0.1:8787/v1/orders \
  -H 'content-type: application/json' \
  -d '{"customer":"curl","product":"wallet","amount":100}' | jq -r .order.id)
curl -sS -X POST http://127.0.0.1:8787/v1/verify-slip \
  -F order_id=$OID -F amount=100 \
  -F file=@/workspace/veltshop-discord-topup/fixtures/slip_ok_dashed.png
```

### Security smoke

```bash
node scripts/smoke-topup-security.mjs
node --experimental-strip-types --test src/lib/shop/topup-security.test.ts
```

Fake POST with `slipVerified: true` and no image → rejected (no credit).

## Env still needed from user (secret channel — no values in chat)

| Var | Purpose |
| --- | --- |
| `ADMIN_EMAILS` or `ADMIN_EMAIL` | Admin allow-list |
| `BETTER_AUTH_SECRET` | Production auth secret |
| `DATABASE_URL` | Production Postgres |
| `SLIP_VERIFY_URL` | Optional override (default `http://127.0.0.1:8787`) |

Not required for slips: Thunder / Slip2Go API keys.

## Status

- Auth: ON
- PromptPay: 0928160016
- Topup → `topupWithSlip` → server `:8787` verify → credit
- Credit only on verify pass; no auto code release; no client trust flags

## Customer URLs (dev :8080)

| Path | Purpose |
| --- | --- |
| `/shop/topup` | PromptPay QR (real EMV) + slip upload → `topupWithSlip` → `:8787` |
| `/shop/history` | ประวัติ เติมเงิน/ซื้อ |
| `/shop/settings` | ตั้งค่าร้าน (PromptPay / True Wallet) — **admin only** to save |
| `/admin` | แอดมินเต็ม — **ADMIN_EMAILS only** |

Profile menu (header top-right): โปรไฟล์ · ประวัติ · ตั้งค่า · (แอดมิน/แก้ร้าน if admin) · ออกจากระบบ.

Catalog pencil / เพิ่มสินค้า / image upload / saveProduct / saveShopSettings: **admin only** (UI hidden + `requireAdmin` on server).
