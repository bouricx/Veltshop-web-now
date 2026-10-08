import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPromptPayPayload, formatPromptPayTarget } from "./promptpay-qr.ts";

describe("promptpay-qr", () => {
  it("formats mobile to 0066…", () => {
    assert.equal(formatPromptPayTarget("0928160016"), "0066928160016");
  });
  it("builds EMV payload with CRC", () => {
    const p = buildPromptPayPayload("0928160016", 50);
    assert.equal(p.slice(0, 10), "0002010102");
    assert.match(p.slice(-4), /^[0-9A-F]{4}$/);
    assert.ok(p.includes("0066928160016"));
    assert.ok(p.includes("50.00"));
  });
});
