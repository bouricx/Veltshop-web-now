import { test } from "node:test";
import assert from "node:assert/strict";
import { gatewayConfigured } from "../src/lib/shop/chat-credentials.server.ts";

test("gateway readiness recognizes request-scoped OIDC without requiring an environment token", () => {
  const symbol = Symbol.for("@vercel/request-context");
  const priorContext = globalThis[symbol];
  const priorKey = process.env.AI_GATEWAY_API_KEY;
  const priorToken = process.env.VERCEL_OIDC_TOKEN;
  try {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    globalThis[symbol] = { get: () => ({}) };
    assert.equal(gatewayConfigured(), false);
    globalThis[symbol] = {
      get: () => ({ headers: { "x-vercel-oidc-token": "isolated-fixture-token" } }),
    };
    assert.equal(gatewayConfigured(), true);
    globalThis[symbol] = { get: () => ({}) };
    process.env.AI_GATEWAY_API_KEY = "isolated-fixture-key";
    assert.equal(gatewayConfigured(), true);
  } finally {
    globalThis[symbol] = priorContext;
    if (priorKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = priorKey;
    if (priorToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = priorToken;
  }
});
