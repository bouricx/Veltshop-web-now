import test from "node:test";
import assert from "node:assert/strict";
import { authRuntimeReadiness } from "./runtime-readiness.ts";
test("Vercel refuses process-local secrets and temporary database", () => {
  assert.deepEqual(authRuntimeReadiness({ VERCEL: "1" }), {
    ready: false,
    missing: ["BETTER_AUTH_SECRET", "DATABASE_URL"],
  });
});
test("stable production secret and database are ready", () => {
  assert.deepEqual(
    authRuntimeReadiness({
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "stable-secret",
      DATABASE_URL: "postgres://test",
    }),
    { ready: true, missing: [] },
  );
});
test("blank configuration is missing and local preview remains usable", () => {
  assert.equal(
    authRuntimeReadiness({ VERCEL: "1", BETTER_AUTH_SECRET: "  ", DATABASE_URL: "  " }).ready,
    false,
  );
  assert.deepEqual(authRuntimeReadiness({ NODE_ENV: "development" }), { ready: true, missing: [] });
});
