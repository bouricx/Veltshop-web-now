/**
 * Quick smoke: fake "slipVerified: true" without a real slip image must NOT credit.
 * Exercises shared :8787 health + local parse gate used by topupWithSlip.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const actions = readFileSync(join(root, "src/lib/shop/actions.ts"), "utf8");
const topup = readFileSync(join(root, "src/routes/shop/topup.tsx"), "utf8");

assert.equal(/data\.slipVerified/.test(actions), false);
assert.equal(/data\.verifiedAmount/.test(actions), false);
assert.match(actions, /topupWithSlip/);
assert.equal(/slipVerified/.test(topup), false);
assert.match(topup, /topupWithSlip/);

const base = process.env.SLIP_VERIFY_URL?.trim() || "http://127.0.0.1:8787";
const health = await fetch(`${base}/health`).then((r) => r.json());
assert.equal(health.ok, true);
assert.equal(health.promptpay, "0928160016");
assert.equal(health.auto_release, false);

// Simulate the old attack shape: client claims verified with no file bytes.
// Server parse gate must reject before any credit insert.
const { slipImageToBlob } = await import("../src/lib/shop/slip-verify-upstream.server.ts");
assert.equal(slipImageToBlob(""), null);
assert.equal(slipImageToBlob(undefined), null);

console.log("smoke-topup-security: PASS");
console.log(`  :8787 health ok · PromptPay ${health.promptpay} · auto_release=${health.auto_release}`);
console.log("  fake slipVerified/no-file → no blob → no credit path");
