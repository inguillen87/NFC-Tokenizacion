#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function required(name, value) {
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

async function main() {
  const outDir = getArg("out", "tmp/token-metadata");
  const bid = required("bid", getArg("bid"));
  const uid = required("uid", getArg("uid")).toUpperCase();
  const image = required("image", getArg("image"));
  const passportUrl = getArg("passport_url", "");
  const winery = getArg("winery", "Unknown winery");
  const region = getArg("region", "Unknown region");
  const vintage = getArg("vintage", "N/A");

  const payload = {
    name: `Nexid Digital Twin ${bid}`,
    description: `Digital twin minted from SUN validation for ${bid} / ${uid}.`,
    image,
    external_url: passportUrl || undefined,
    attributes: [
      { trait_type: "BID", value: bid },
      { trait_type: "UID", value: uid },
      { trait_type: "Winery", value: winery },
      { trait_type: "Region", value: region },
      { trait_type: "Vintage", value: vintage },
      { trait_type: "Layer", value: "tokenization-ready" },
    ],
  };

  await mkdir(outDir, { recursive: true });
  const file = join(outDir, `${bid}-${uid}.json`);
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, file, payload })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "metadata_generation_failed" })}\n`);
  process.exit(1);
});
