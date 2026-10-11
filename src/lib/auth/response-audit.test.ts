import assert from "node:assert/strict";
import test from "node:test";
import { preserveAuthResponse } from "./response-audit.ts";

test("OAuth redirect and session cookie survive audit failure", async () => {
  const response = new Response(null, {
    status: 302,
    headers: {
      location: "/shop",
      "set-cookie": "session=valid; Path=/; HttpOnly; Secure",
    },
  });
  let reported = 0;
  const result = await preserveAuthResponse(
    response,
    async () => {
      throw new Error("audit database unavailable");
    },
    () => {
      reported++;
    },
  );
  assert.equal(result, response);
  assert.equal(result.status, 302);
  assert.equal(result.headers.get("location"), "/shop");
  assert.equal(result.headers.get("set-cookie"), response.headers.get("set-cookie"));
  assert.equal(reported, 1);
});

test("successful audit runs once without consuming sign-in response", async () => {
  const response = Response.json({ user: { id: "member" } });
  let calls = 0;
  assert.equal(
    await preserveAuthResponse(response, async () => {
      calls++;
    }),
    response,
  );
  assert.equal(calls, 1);
  assert.deepEqual(await response.json(), { user: { id: "member" } });
});
