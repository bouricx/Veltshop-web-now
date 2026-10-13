import { test } from "node:test";
import assert from "node:assert/strict";
import { formatThaiClock, toThaiDateTimeInput, fromThaiDateTimeInput } from "../src/lib/shop/meta.ts";

test("Thai clock and scheduling do not depend on the device timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Bangkok"]) {
      process.env.TZ = timezone;
      assert.deepEqual(formatThaiClock(new Date("2026-12-31T18:05:09Z")), {
        time: "01:05:09", date: "ศ. 1 ม.ค. 2570",
      });
      assert.equal(toThaiDateTimeInput("2026-10-13T00:30:00Z"), "2026-10-13T07:30");
      assert.equal(fromThaiDateTimeInput("2026-10-13T07:30"), "2026-10-13T00:30:00.000Z");
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
