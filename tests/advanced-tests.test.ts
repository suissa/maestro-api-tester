import assert from "node:assert/strict";
import testRunner from "node:test";
import { percentile, summarizeLatencies } from "../src/advanced-tests.ts";

testRunner("percentile handles sorted and unsorted samples", () => {
  assert.equal(percentile([10, 1, 5, 20], 0.5), 5);
  assert.equal(percentile([], 0.95), 0);
});

testRunner("latency summary includes tail percentiles and mean", () => {
  assert.deepEqual(summarizeLatencies([10, 20, 30, 40]), {
    min: 10,
    p50: 20,
    p95: 40,
    p99: 40,
    max: 40,
    mean: 25,
  });
  assert.deepEqual(summarizeLatencies([]), {
    min: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    max: 0,
    mean: 0,
  });
});
