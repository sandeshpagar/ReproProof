import assert from "node:assert/strict";
import test from "node:test";

import { getHealthResponse } from "../src/server/health.js";

test("health response identifies a ready ReproProof application", () => {
  assert.deepEqual(getHealthResponse(), {
    status: "ok",
    name: "ReproProof",
    version: "0.1.0",
  });
});
