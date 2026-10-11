import assert from "node:assert/strict";
import test from "node:test";
import { readPreviewBearerToken } from "./preview-token.ts";
test("deployed Google session ignores stale preview bearer", () => {
  for (const host of [
    "veltshop-website.vercel.app",
    "veltshop.website",
    "localhost",
    "evilgrok-sandbox.com",
  ]) {
    assert.equal(
      readPreviewBearerToken(host, () => {
        throw new Error("must not read storage");
      }),
      null,
    );
  }
});
test("embedded preview keeps bearer authentication", () => {
  assert.equal(
    readPreviewBearerToken("app.grok-sandbox.com", () => "preview-token"),
    "preview-token",
  );
});
test("blocked preview storage returns no token", () => {
  assert.equal(
    readPreviewBearerToken("app.grok-sandbox.com", () => {
      throw new Error("blocked");
    }),
    null,
  );
});
