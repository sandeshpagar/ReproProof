import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const webRoot = resolve(process.cwd(), "web");

test("dashboard contains the Phase 4 audit workflow controls", async () => {
  const html = await readFile(resolve(webRoot, "index.html"), "utf8");

  for (const requiredId of [
    "audit-form",
    "repository-path",
    "run-audit",
    "audit-progress",
    "results-section",
    "findings-list",
    "run-test",
    "run-rehearsal",
    "export-markdown",
    "export-json",
  ]) {
    assert.match(html, new RegExp(`id=["']${requiredId}["']`));
  }

  assert.match(html, /data-filter="fail"/);
  assert.match(html, /aria-live="polite"/);
});

test("dashboard client wires audit, execution, filtering, and export behavior", async () => {
  const script = await readFile(resolve(webRoot, "app.js"), "utf8");
  const styles = await readFile(resolve(webRoot, "styles.css"), "utf8");

  assert.match(script, /\/api\/audits/);
  assert.match(script, /run-clean-room|rehearsal/i);
  assert.match(script, /downloadFile/);
  assert.match(script, /data-filter/);
  assert.match(styles, /\.finding-card/);
  assert.match(styles, /@media \(max-width: 760px\)/);
});
