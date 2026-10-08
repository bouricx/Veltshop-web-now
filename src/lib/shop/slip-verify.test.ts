import assert from "node:assert/strict";
import test from "node:test";
import { matchSlipText, SHOP_PROMPTPAY } from "./slip-verify.ts";

test("verified when amount and PromptPay both present", () => {
  const ocr = `
    โอนเงินสำเร็จ
    จำนวนเงิน 150.00 บาท
    พร้อมเพย์ ${SHOP_PROMPTPAY}
    ผู้รับ VELTSHOP
  `;
  const r = matchSlipText({ ocrText: ocr, expectedAmount: 150 });
  assert.equal(r.status, "verified");
  assert.equal(r.matchedAmount, true);
  assert.equal(r.matchedAccount, true);
});

test("uncertain when only amount matches", () => {
  const ocr = `ยอด 200 บาท ไปบัญชี 0999999999`;
  const r = matchSlipText({ ocrText: ocr, expectedAmount: 200 });
  assert.equal(r.status, "uncertain");
  assert.equal(r.matchedAmount, true);
  assert.equal(r.matchedAccount, false);
});

test("rejected when neither matches", () => {
  const ocr = `รายการทดสอบ ไม่มียอดและบัญชี`;
  const r = matchSlipText({ ocrText: ocr, expectedAmount: 99 });
  assert.equal(r.status, "rejected");
});

test("empty OCR is uncertain fail-closed", () => {
  const r = matchSlipText({ ocrText: "   ", expectedAmount: 50 });
  assert.equal(r.status, "uncertain");
});
