#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateSunLocationPhysicalMatrix } from "./lib/sun-location-physical-certification.mjs";

const MAX_MATRIX_BYTES = 1_000_000;
const matrixArg = process.argv[2];

if (!matrixArg) {
  console.error("Usage: node scripts/validate-sun-location-physical-certification.mjs <matrix.json>");
  process.exit(2);
}

const matrixPath = path.resolve(matrixArg);
let source;
try {
  source = await readFile(matrixPath, "utf8");
} catch {
  console.error(JSON.stringify({ ok: false, status: "unreadable", matrixPath }, null, 2));
  process.exit(2);
}

if (Buffer.byteLength(source, "utf8") > MAX_MATRIX_BYTES) {
  console.error(JSON.stringify({ ok: false, status: "rejected", reason: "matrix_size_limit_exceeded" }, null, 2));
  process.exit(2);
}

let matrix;
try {
  matrix = JSON.parse(source);
} catch {
  console.error(JSON.stringify({ ok: false, status: "rejected", reason: "invalid_json" }, null, 2));
  process.exit(2);
}

const result = validateSunLocationPhysicalMatrix(matrix);
console.log(JSON.stringify({ ...result, matrixPath }, null, 2));
if (!result.ok) process.exit(1);
