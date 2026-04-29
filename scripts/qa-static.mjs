#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const targetRoots = [
  path.join(repoRoot, "apps/web/src"),
  path.join(repoRoot, "apps/dashboard/src"),
];

const fileExtensions = new Set([".tsx", ".jsx", ".ts", ".js"]);

const skipPathParts = [
  `${path.sep}demo${path.sep}`,
  `${path.sep}tests${path.sep}`,
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}fixtures${path.sep}`,
  `${path.sep}docs${path.sep}`,
  `${path.sep}app${path.sep}api${path.sep}`,
];

const forbiddenHrefPatterns = [
  { label: 'href="#"', regex: /href\s*=\s*["']#["']/gi },
  { label: 'href=""', regex: /href\s*=\s*["'][\s]*["']/gi },
  { label: "javascript:void(0)", regex: /javascript:\s*void\(0\)/gi },
];

const placeholderPatterns = [
  { label: "coming soon", regex: /coming\s+soon/gi },
  { label: "próximamente", regex: /pr[oó]ximamente/gi },
  { label: "TODO", regex: /\bTODO\b/g },
  { label: "mock only", regex: /mock\s+only/gi },
  { label: "fake data", regex: /fake\s+data/gi },
];

const actionLabels = [
  "Registrarse",
  "Recuperar contraseña",
  "Invitar usuario",
  "Ir al login del portal consumidor",
  "Claim ownership",
  "Save product",
  "Marketplace",
];

const violations = [];

function shouldSkip(filePath) {
  if (filePath.includes(`${path.sep}.next${path.sep}`) || filePath.includes(`${path.sep}node_modules${path.sep}`)) return true;
  if (filePath.endsWith(".stories.tsx") || filePath.endsWith(".stories.jsx")) return true;
  return skipPathParts.some((part) => filePath.includes(part));
}

function collectFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkip(full + path.sep)) continue;
      collectFiles(full, acc);
      continue;
    }
    if (!fileExtensions.has(path.extname(entry.name))) continue;
    if (shouldSkip(full)) continue;
    acc.push(full);
  }
  return acc;
}

function addViolation(filePath, rule, details) {
  violations.push({ filePath: path.relative(repoRoot, filePath), rule, details });
}

function hasRealActionAttrs(attrs) {
  const normalized = String(attrs || "");
  if (/\bhref\s*=\s*["'][^"']+["']/i.test(normalized)) return true;
  if (/\bonClick\s*=\s*\{/i.test(normalized)) return true;
  if (/\bformAction\s*=\s*/i.test(normalized)) return true;
  if (/\btype\s*=\s*["']submit["']/i.test(normalized)) return true;
  return false;
}

function scanInteractiveLabels(filePath, content) {
  for (const label of actionLabels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const buttonRegex = new RegExp(`<button([^>]*)>[\\s\\S]{0,200}?${escapedLabel}[\\s\\S]{0,200}?<\\/button>`, "gi");
    for (const match of content.matchAll(buttonRegex)) {
      const attrs = match[1] || "";
      if (!hasRealActionAttrs(attrs)) {
        addViolation(filePath, `label-without-action:${label}`, "<button> contains action label but lacks onClick/formAction/submit action");
      }
    }

    const anchorRegex = new RegExp(`<a([^>]*)>[\\s\\S]{0,200}?${escapedLabel}[\\s\\S]{0,200}?<\\/a>`, "gi");
    for (const match of content.matchAll(anchorRegex)) {
      const attrs = match[1] || "";
      if (!/\bhref\s*=\s*["'][^"']+["']/i.test(attrs)) {
        addViolation(filePath, `label-without-action:${label}`, "<a> contains action label but lacks valid href");
      }
    }

    const linkRegex = new RegExp(`<Link([^>]*)>[\\s\\S]{0,200}?${escapedLabel}[\\s\\S]{0,200}?<\\/Link>`, "gi");
    for (const match of content.matchAll(linkRegex)) {
      const attrs = match[1] || "";
      if (!/\bhref\s*=\s*\{/i.test(attrs) && !/\bhref\s*=\s*["'][^"']+["']/i.test(attrs)) {
        addViolation(filePath, `label-without-action:${label}`, "<Link> contains action label but lacks href");
      }
    }
  }
}

for (const root of targetRoots) {
  if (!fs.existsSync(root)) continue;
  const files = collectFiles(root);
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");

    for (const rule of forbiddenHrefPatterns) {
      if (rule.regex.test(content)) {
        addViolation(filePath, `forbidden-href:${rule.label}`, "forbidden href pattern detected");
      }
      rule.regex.lastIndex = 0;
    }

    for (const rule of placeholderPatterns) {
      if (rule.regex.test(content)) {
        addViolation(filePath, `placeholder-copy:${rule.label}`, "placeholder copy detected outside allowed paths");
      }
      rule.regex.lastIndex = 0;
    }

    scanInteractiveLabels(filePath, content);
  }
}

if (violations.length) {
  console.error("Static QA failed. Found dead/fake UI patterns:\n");
  for (const issue of violations) {
    console.error(`- ${issue.filePath} :: ${issue.rule} :: ${issue.details}`);
  }
  process.exit(1);
}

console.log("Static QA passed: no dead buttons, fake flows, or unsafe placeholders detected.");
