import { test } from "node:test";
import assert from "node:assert/strict";
import { answerShopQuestion } from "../src/lib/shop/chat-service.server.ts";
function fakeSql() {
  const hits = new Map();
  const queries = [];
  return {
    queries,
    query: async (query, params = []) => {
      queries.push(query);
      if (query.includes("request_limits")) {
        const n = (hits.get(params[0]) || 0) + 1;
        hits.set(params[0], n);
        return [{ hits: n }];
      }
      if (query.includes("site_configuration")) return [{ value: { name: "Test shop" } }];
      if (query.includes("FROM products"))
        return [
          {
            name: "Public item",
            price: 89,
            stock: 9,
            warranty_days: 7,
            description: "Public description",
          },
        ];
      throw new Error("Unexpected query");
    },
  };
}
const question = [{ role: "user", content: "มีสินค้าอะไรบ้าง" }];
test("unconfigured AI never calls a provider or reads catalog data", async () => {
  const sql = fakeSql();
  const answer = await answerShopQuestion(sql, "test-user", question, {
    available: false,
    generate: async () => {
      throw new Error("must not run");
    },
  });
  assert.equal(answer.ok, false);
  assert.equal(sql.queries.length, 0);
});
test("shop chat supplies only public catalog data and bounds generation", async () => {
  const sql = fakeSql();
  let request;
  const answer = await answerShopQuestion(sql, "test-user", question, {
    available: true,
    generate: async (options) => {
      request = options;
      return { text: "มีสินค้าราคา 89 บาทค่ะ" };
    },
  });
  assert.equal(answer.ok, true);
  assert.match(answer.text, /89/);
  assert.equal(request.maxOutputTokens, 500);
  assert.equal(request.maxRetries, 0);
  assert.equal(request.abortSignal instanceof AbortSignal, true);
  assert.match(request.system, /Public item/);
  assert.match(
    sql.queries.find((q) => q.includes("FROM products")),
    /p.active=true AND c.visible=true/,
  );
  assert.equal(
    sql.queries.some((q) => /FROM ("user"|orders|payments|inventory)/.test(q)),
    false,
  );
});
test("provider errors do not expose upstream credentials or pretend to answer", async () => {
  const answer = await answerShopQuestion(fakeSql(), "test-user", question, {
    available: true,
    generate: async () => {
      throw new Error("secret-provider-value");
    },
  });
  assert.equal(answer.ok, false);
  assert.equal(JSON.stringify(answer).includes("secret-provider-value"), false);
  assert.equal("text" in answer, false);
});
test("per-user limit stops generation after five requests in the window", async () => {
  const sql = fakeSql();
  let calls = 0;
  let answer;
  for (let i = 0; i < 6; i++)
    answer = await answerShopQuestion(sql, "test-user", question, {
      available: true,
      generate: async () => {
        calls++;
        return { text: "คำตอบ" };
      },
    });
  assert.equal(calls, 5);
  assert.equal(answer.ok, false);
});
