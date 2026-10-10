import test from "node:test";
import assert from "node:assert/strict";
import { verifySlip2Go } from "../src/lib/shop/slip2go.server.ts";

test("missing configuration never calls a provider or grants credit", async () => {
  const old = process.env.SLIP2GO_API_SECRET;
  delete process.env.SLIP2GO_API_SECRET;
  try {
    assert.equal((await verifySlip2Go(new Blob(["slip"]), "slip.png", 50, "receiver")).ok, false);
  } finally {
    if (old !== undefined) process.env.SLIP2GO_API_SECRET = old;
  }
});
test("official response must validate conditions, amount, reference and date", async () => {
  const original = globalThis.fetch;
  const secret = process.env.SLIP2GO_API_SECRET;
  const endpoint = process.env.SLIP2GO_VERIFY_URL;
  process.env.SLIP2GO_API_SECRET = "unit-test-only";
  process.env.SLIP2GO_VERIFY_URL = "https://connect.slip2go.com/api/verify-slip/qr-image/info";
  try {
    for (const [code, amount, reference, date, expected] of [
      ["200200", 50, "ref", new Date().toISOString(), true],
      ["200000", 50, "ref", new Date().toISOString(), false],
      ["200401", 50, "ref", new Date().toISOString(), false],
      ["200501", 50, "ref", new Date().toISOString(), false],
      ["200200", 51, "ref", new Date().toISOString(), false],
      ["200200", 50, "", new Date().toISOString(), false],
      ["200200", 50, "ref", "2020-01-01T00:00:00Z", false],
    ]) {
      globalThis.fetch = async (url, options) => {
        const payload = JSON.parse(options.body.get("payload"));
        assert.equal(payload.checkDuplicate, true);
        assert.equal(payload.checkReceiver[0].accountNumber, "receiver");
        assert.equal(options.headers.Authorization, "unit-test-only");
        return Response.json({ code, data: { amount, transRef: reference, dateTime: date } });
      };
      assert.equal(
        (await verifySlip2Go(new Blob(["slip"]), "slip.png", 50, "receiver")).ok,
        expected,
      );
    }
    process.env.SLIP2GO_VERIFY_URL = "https://attacker.example/api/verify-slip/qr-image/info";
    await assert.rejects(verifySlip2Go(new Blob(["slip"]), "slip.png", 50, "receiver"));
  } finally {
    globalThis.fetch = original;
    if (secret === undefined) delete process.env.SLIP2GO_API_SECRET;
    else process.env.SLIP2GO_API_SECRET = secret;
    if (endpoint === undefined) delete process.env.SLIP2GO_VERIFY_URL;
    else process.env.SLIP2GO_VERIFY_URL = endpoint;
  }
});
