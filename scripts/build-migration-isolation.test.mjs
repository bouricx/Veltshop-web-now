import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("production build does not invoke database migrations through lifecycle hooks", async () => {
  const { scripts } = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const visited = new Set();
  function inspect(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const command = scripts[name] || "";
    assert.doesNotMatch(
      command,
      /migrate|\bpsql\b|db:push/i,
      `${name} must not mutate the database`,
    );
    for (const match of command.matchAll(/npm\s+run\s+([\w:-]+)/g)) {
      for (const hook of [`pre${match[1]}`, match[1], `post${match[1]}`]) inspect(hook);
    }
  }
  for (const name of ["prebuild", "build", "postbuild"]) inspect(name);
  assert.equal(scripts["db:migrate"], "node scripts/migrate.mjs");
});

test("repository migration 0018 is valid UTF-8 and applies after its predecessors", async () => {
  const root = new URL("../migrations/", import.meta.url);
  const db = new PGlite();
  try {
    const names = (await readdir(root))
      .filter((n) => /^\d.*\.sql$/.test(n) && n <= "0018_facebook_stream_catalog.sql")
      .sort();
    assert.ok(names.includes("0018_facebook_stream_catalog.sql"));
    for (const name of names) {
      const bytes = await readFile(new URL(name, root));
      const sql = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      await db.exec(sql);
    }
    const { rows } = await db.query("SELECT price FROM products WHERE id='veltshop-prime-video-1m'");
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => Number(row.price) === 59));
  } finally {
    await db.close();
  }
});
