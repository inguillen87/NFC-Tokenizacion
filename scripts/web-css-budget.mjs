import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

export const WEB_CSS_SOURCE = "apps/web/src/app/globals.css";
export const WEB_CSS_BASELINE = "apps/web/css-budget-baseline.json";
export const CSS_METRICS = Object.freeze([
  "physicalLines", "importantDeclarations", "distinctHexColors", "gradientFunctions",
]);

// Read CSS names including escapes, so an escaped color or function has the
// same measurement as its ordinary spelling. Strings and URLs stay opaque.
function readName(value, start) {
  let index = start, name = "";
  while (index < value.length) {
    const character = value[index];
    if (/[\w-]/.test(character) || character.codePointAt(0) >= 128) {
      name += character;
      index++;
    } else if (character === "\\" && index + 1 < value.length) {
      const hex = /^[\da-f]{1,6}/i.exec(value.slice(index + 1))?.[0];
      if (hex) {
        const point = Number.parseInt(hex, 16);
        name += String.fromCodePoint(point > 0 && point <= 0x10ffff ? point : 0xfffd);
        index += hex.length + 1;
        if (/\s/.test(value[index] ?? "")) index++;
      } else {
        name += value[index + 1];
        index += 2;
      }
    } else break;
  }
  return { name, end: index };
}

function skipString(value, start) {
  const quote = value[start];
  let index = start + 1;
  while (index < value.length) {
    if (value[index] === "\\") index += 2;
    else if (value[index++] === quote) break;
  }
  return index;
}

function skipComment(value, start) {
  const end = value.indexOf("*/", start + 2);
  return end === -1 ? value.length : end + 2;
}

function skipUrl(value, start) {
  let index = start, depth = 1;
  while (index < value.length && depth) {
    const character = value[index];
    if (character === "'" || character === '"') index = skipString(value, index);
    else if (value.startsWith("/*", index)) index = skipComment(value, index);
    else if (character === "\\") index += 2;
    else {
      if (character === "(") depth++;
      if (character === ")") depth--;
      index++;
    }
  }
  return index;
}

function canonicalHex(name) {
  if (!/^(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(name)) return null;
  let hex = name.toLowerCase();
  if (hex.length <= 4) hex = [...hex].map(character => character + character).join("");
  return hex.length === 6 ? hex + "ff" : hex;
}

function valueMetrics(value, colors) {
  let index = 0, gradients = 0;
  while (index < value.length) {
    const character = value[index];
    if (character === "'" || character === '"') index = skipString(value, index);
    else if (value.startsWith("/*", index)) index = skipComment(value, index);
    else if (character === "#") {
      const token = readName(value, index + 1);
      const color = canonicalHex(token.name);
      if (color) colors.add(color);
      index = token.end;
    } else if (/[a-z_-]/i.test(character) || character === "\\" || character.codePointAt(0) >= 128) {
      const token = readName(value, index);
      const name = token.name.toLowerCase();
      index = Math.max(token.end, index + 1);
      if (value[index] === "(") {
        if (name === "url") index = skipUrl(value, index + 1);
        else {
          if (/^(?:-(?:webkit|moz|o)-)?(?:repeating-)?(?:linear|radial|conic)-gradient$/.test(name)) gradients++;
          index++;
        }
      }
    } else index++;
  }
  return gradients;
}

export function measureWebCss(source) {
  const normalized = source.replace(/\r\n?/g, "\n");
  const colors = new Set();
  let importantDeclarations = 0, gradientFunctions = 0;
  const tree = postcss.parse(normalized, { from: WEB_CSS_SOURCE });
  tree.walkDecls(declaration => {
    if (declaration.important) importantDeclarations++;
    gradientFunctions += valueMetrics(declaration.value, colors);
  });
  return {
    physicalLines: normalized.length ? normalized.split("\n").length - Number(normalized.endsWith("\n")) : 0,
    importantDeclarations,
    distinctHexColors: colors.size,
    gradientFunctions,
  };
}

export function compareWebCssBudget(metrics, baseline) {
  if (baseline?.schema !== "nexid.web-global-css-budget.v1" || baseline.sourcePath !== WEB_CSS_SOURCE) {
    throw new Error("Invalid Web CSS budget schema or source path");
  }
  if (!baseline.metrics || Object.keys(baseline.metrics).sort().join() !== [...CSS_METRICS].sort().join()) {
    throw new Error("Web CSS budget must specify exactly four metric limits");
  }
  return CSS_METRICS.flatMap(metric => {
    const limit = baseline.metrics[metric], actual = metrics[metric];
    if (!Number.isSafeInteger(limit) || limit < 0 || !Number.isSafeInteger(actual) || actual < 0) {
      throw new Error("Invalid Web CSS budget value: " + metric);
    }
    return actual > limit ? [{ metric, actual, limit, growth: actual - limit }] : [];
  });
}

export function checkWebCssBudget(repoRoot) {
  const source = readFileSync(resolve(repoRoot, WEB_CSS_SOURCE), "utf8");
  const baseline = JSON.parse(readFileSync(resolve(repoRoot, WEB_CSS_BASELINE), "utf8"));
  const metrics = measureWebCss(source);
  return { metrics, limits: baseline.metrics, growth: compareWebCssBudget(metrics, baseline) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkWebCssBudget(process.cwd());
    console.log(JSON.stringify(result, null, 2));
    if (result.growth.length) process.exitCode = 1;
  } catch (error) {
    console.error("Web CSS budget failed: " + error.message);
    process.exitCode = 1;
  }
}
