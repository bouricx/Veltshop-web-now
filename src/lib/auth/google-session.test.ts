import test from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { sessionCookieOptions } from "./session-options.ts";

const origin = "https://veltshop.test";
const secret = "test-only-stable-secret-with-at-least-32-characters";

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

test("Google callback creates a real session, persists across server restart and sign-out revokes it", async () => {
  const data = { user: [], account: [], session: [], verification: [] };
  const makeAuth = (key = secret) =>
    betterAuth({
      baseURL: origin,
      secret: key,
      database: memoryAdapter(data),
      advanced: sessionCookieOptions,
      socialProviders: {
        google: {
          clientId: "test-client",
          clientSecret: "test-secret",
          disableIdTokenSignIn: true,
        },
      },
      session: { cookieCache: { enabled: false } },
    });
  const auth = makeAuth();
  const start = await auth.handler(
    new Request(origin + "/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify({ provider: "google", callbackURL: origin + "/shop" }),
    }),
  );
  assert.equal(start.status, 200);
  const state = new URL((await start.json()).url).searchParams.get("state")!;
  const originalFetch = globalThis.fetch;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  // Only Google's token response is simulated; callback, account/session creation,
  // cookie signing, DB lookup and revocation use the installed Better Auth runtime.
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://oauth2.googleapis.com/token")
      return Response.json({
        access_token: "test-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        id_token: [
          encode({ alg: "none" }),
          encode({
            sub: "google-member",
            name: "Google Member",
            email: "google-member@example.test",
            email_verified: true,
            picture: "https://example.test/avatar.png",
          }),
          "test",
        ].join("."),
      });
    throw new Error("Unexpected network request in isolated test: " + url);
  };
  let callback: Response;
  try {
    callback = await auth.handler(
      new Request(
        origin + "/api/auth/callback/google?" + new URLSearchParams({ state, code: "test-code" }),
        { headers: { cookie: cookies(start) } },
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), origin + "/shop");
  const sessionCookie = cookies(callback);
  assert.match(sessionCookie, /__Host-grok-auth.session_token=/);
  assert.match(callback.headers.get("set-cookie")!, /Secure/);
  assert.match(callback.headers.get("set-cookie")!, /HttpOnly/);
  const getSession = async (instance: ReturnType<typeof makeAuth>) => {
    const response = await instance.handler(
      new Request(origin + "/api/auth/get-session", { headers: { cookie: sessionCookie } }),
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const session = await getSession(auth);
  assert.equal(session.user.name, "Google Member");
  assert.equal(session.user.image, "https://example.test/avatar.png");
  assert.equal(data.account.length, 1);
  assert.equal((data.account[0] as { providerId: string }).providerId, "google");
  assert.equal((await getSession(makeAuth())).user.id, session.user.id);
  assert.equal(await getSession(makeAuth("different-test-secret-at-least-32-characters")), null);
  const logout = await auth.handler(
    new Request(origin + "/api/auth/sign-out", {
      method: "POST",
      headers: { cookie: sessionCookie, origin },
    }),
  );
  assert.equal(logout.status, 200);
  assert.equal(await getSession(makeAuth()), null);
  assert.equal(data.user.length, 1);
  assert.equal(data.account.length, 1);
});
