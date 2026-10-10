import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slipImageToBlob } from "./slip-verify-upstream.server.ts";

const here = dirname(fileURLToPath(import.meta.url));

test("slipImageToBlob rejects empty / non-image client payloads (no fake credit path)", () => {
  assert.equal(slipImageToBlob(""), null);
  assert.equal(slipImageToBlob("   "), null);
  assert.equal(slipImageToBlob("true"), null);
  assert.equal(slipImageToBlob('{"slipVerified":true,"verifiedAmount":999}'), null);
  assert.equal(slipImageToBlob("not-a-real-slip"), null);
});

test("actions.ts never reads client slipVerified / verifiedAmount", () => {
  const src = readFileSync(join(here, "actions.ts"), "utf8");
  assert.equal(/data\.slipVerified/.test(src), false, "must not read data.slipVerified");
  assert.equal(/data\.verifiedAmount/.test(src), false, "must not read data.verifiedAmount");
  assert.match(src, /export const topupWithSlip/);
  assert.match(src, /paymentProviders\.promptpay\.verify/);
  const providers = readFileSync(join(here, "payment-providers.server.ts"), "utf8");
  assert.match(providers, /return verifySlip2Go\(input\.file/);
  assert.match(providers, /promptpay:.*verify: slipVerify/);
  // Public processPayment validator must not list those fields
  const validatorBlock = src.slice(
    src.indexOf("export const processPayment"),
    src.indexOf("export const topupWithSlip"),
  );
  assert.equal(/slipVerified\??:/.test(validatorBlock), false);
  assert.equal(/verifiedAmount\??:/.test(validatorBlock), false);
});

test("True Wallet slips are stored for manual review and cannot reach auto-credit", () => {
  const src = readFileSync(join(here, "actions.ts"), "utf8");
  const walletStart = src.indexOf('if (method === "truewallet")');
  const firstId = src.indexOf('const id = uid("pay")', walletStart);
  const walletEnd = src.indexOf('const id = uid("pay")', firstId + 1);
  assert.ok(walletStart >= 0 && walletEnd > walletStart);
  const walletBranch = src.slice(walletStart, walletEnd);
  assert.match(walletBranch, /status,?\s*provider/);
  assert.match(walletBranch, /manual-review/);
  assert.match(walletBranch, /slip_evidence/);
  assert.match(walletBranch, /\$\{fee\}, 0, 'pending', 'manual-review'/);
  assert.doesNotMatch(walletBranch, /verifySlipWithSharedApi/);
});

test("PromptPay credit requires verified destination and exact amount", () => {
  const src = readFileSync(join(here, "actions.ts"), "utf8");
  assert.match(src, /!verify\.promptpayMatched/);
  assert.match(src, /verify\.amountFound === amount/);
});

test("admin cannot change the QR destination without changing the fixed verifier target", () => {
  const src = readFileSync(join(here, "actions.ts"), "utf8");
  assert.match(src, /next\.receive_account\.replace\(\/\\D\/g, ""\) !== VERIFIER_PROMPTPAY/);
});

test("topup route does not POST slipVerified to processPayment", () => {
  const src = readFileSync(join(here, "../../routes/shop/topup.tsx"), "utf8");
  assert.equal(/slipVerified/.test(src), false);
  assert.equal(/verifiedAmount/.test(src), false);
  assert.match(src, /topupWithSlip/);
  assert.match(src, /method:\s*paymentMethod/);
});
