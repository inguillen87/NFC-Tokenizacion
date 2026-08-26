import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configPaths = [
  "../../../vercel.json",
  "../vercel.json",
  "../../api/vercel.json",
  "../../dashboard/vercel.json",
];

test("Vercel Git auto-deploys stay disabled so releases are explicit Production deploys", async () => {
  const configs = await Promise.all(configPaths.map(async (path) => ({
    path,
    value: JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")),
  })));

  for (const config of configs) {
    assert.equal(
      config.value?.git?.deploymentEnabled,
      false,
      `${config.path} must not create automatic Preview or Production deployments`,
    );
  }
});
