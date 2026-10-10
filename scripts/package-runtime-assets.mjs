// Nitro bundles PGlite's JavaScript into _libs but its WASM/data files must
// remain alongside that bundle. These are server assets, never public files.
import { copyFile, access } from "node:fs/promises";
import { resolve } from "node:path";
const directory = resolve(".vercel/output/functions/__server.func/_libs");
await access(directory);
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"])
  await copyFile(resolve("node_modules/@electric-sql/pglite/dist", name), resolve(directory, name));
console.log("[runtime] PGlite server assets packaged");
