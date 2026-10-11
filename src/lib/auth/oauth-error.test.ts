import test from "node:test";
import assert from "node:assert/strict";
import { googleOAuthError } from "./oauth-error.ts";
test("token exchange failure points to client secret instead of generic retry", () => {
  assert.match(googleOAuthError("invalid_code")!, /GOOGLE_CLIENT_SECRET/);
  assert.match(googleOAuthError("invalid_code")!, /invalid_code/);
});
test("account conflict preserves existing member identity", () => {
  assert.match(googleOAuthError("account_not_linked")!, /คำสั่งซื้อ/);
});
test("missing errors and untrusted query values are safe", () => {
  assert.equal(googleOAuthError(null), null);
  assert.ok(!googleOAuthError("<script>private-token</script>")!.includes("private-token"));
});
