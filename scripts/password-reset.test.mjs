import { test } from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { sessionCookieOptions } from "../src/lib/auth/session-options.ts";
test("password reset uses real hashed credentials, generic requests, expires tokens and revokes sessions", async () => {
  const origin = "https://veltshop.test",
    data = { user: [], account: [], session: [], verification: [] },
    emails = [];
  const auth = betterAuth({
    baseURL: origin,
    secret: "test-only-reset-secret-with-at-least-32-characters",
    database: memoryAdapter(data),
    advanced: sessionCookieOptions,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      resetPasswordTokenExpiresIn: 900,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ url }) => {
        emails.push(url);
      },
    },
  });
  const post = async (path, body) =>
    auth.handler(
      new Request(origin + "/api/auth/" + path, {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const signup = await post("sign-up/email", {
    email: "member@example.test",
    name: "Member",
    password: "original-test-password",
  });
  assert.equal(signup.status, 200);
  const cookies = signup.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const valid = await post("request-password-reset", {
    email: "member@example.test",
    redirectTo: origin + "/reset-password",
  });
  const absent = await post("request-password-reset", {
    email: "absent@example.test",
    redirectTo: origin + "/reset-password",
  });
  assert.equal(valid.status, absent.status);
  assert.deepEqual(await valid.json(), await absent.json());
  assert.equal(emails.length, 1);
  const token = new URL(emails[0]).pathname.split("/").at(-1);
  const reset = await post("reset-password", { token, newPassword: "replacement-test-password" });
  assert.equal(reset.status, 200);
  assert.notEqual(
    (await post("reset-password", { token, newPassword: "another-test-password" })).status,
    200,
  );
  assert.equal(
    (
      await post("sign-in/email", {
        email: "member@example.test",
        password: "original-test-password",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await post("sign-in/email", {
        email: "member@example.test",
        password: "replacement-test-password",
      })
    ).status,
    200,
  );
  const session = await auth.handler(
    new Request(origin + "/api/auth/get-session", { headers: { cookie: cookies } }),
  );
  assert.equal(await session.json(), null);
  assert.ok(!JSON.stringify(data.account).includes("replacement-test-password"));
  await post("request-password-reset", {
    email: "member@example.test",
    redirectTo: origin + "/reset-password",
  });
  const expiredToken = new URL(emails.at(-1)).pathname.split("/").at(-1);
  const verification = data.verification.find((v) => v.identifier?.includes(expiredToken));
  assert.ok(verification);
  verification.expiresAt = new Date(Date.now() - 1000);
  assert.notEqual(
    (await post("reset-password", { token: expiredToken, newPassword: "expired-test-password" }))
      .status,
    200,
  );
});
