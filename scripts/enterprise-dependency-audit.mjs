#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPolicyPath = path.join(root, "scripts", "enterprise-npm-audit-allowlist.v1.json");
const severityRank = Object.freeze({ info: 0, low: 1, moderate: 2, high: 3, critical: 4 });

class AuditPolicyError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "AuditPolicyError";
    this.code = code;
  }
}

function parseArgs(argv) {
  const args = {
    policyPath: defaultPolicyPath,
    productionReportPath: null,
    fullReportPath: null,
    now: new Date(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!["--policy", "--production-report", "--full-report", "--now"].includes(option) || !value) {
      throw new AuditPolicyError("invalid_arguments", `unsupported or incomplete option ${option}`);
    }
    index += 1;
    if (option === "--policy") args.policyPath = path.resolve(value);
    if (option === "--production-report") args.productionReportPath = path.resolve(value);
    if (option === "--full-report") args.fullReportPath = path.resolve(value);
    if (option === "--now") {
      args.now = new Date(value);
      if (Number.isNaN(args.now.getTime())) throw new AuditPolicyError("invalid_arguments", "--now must be an ISO date");
    }
  }
  if (Boolean(args.productionReportPath) !== Boolean(args.fullReportPath)) {
    throw new AuditPolicyError("invalid_arguments", "fixture mode requires both --production-report and --full-report");
  }
  return args;
}

function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new AuditPolicyError("invalid_json", `${label} could not be parsed (${error instanceof Error ? error.message : "unknown error"})`);
  }
}

function runNpmAudit(extraArgs) {
  const npmArgs = ["audit", "--json", "--audit-level=high", ...extraArgs];
  let executable = "npm";
  let executableArgs = npmArgs;
  if (process.platform === "win32") {
    const npmCli = [
      process.env.npm_execpath,
      path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    ].find((candidate) => candidate && existsSync(candidate));
    if (!npmCli) throw new AuditPolicyError("audit_execution_failed", "npm-cli.js could not be located");
    executable = process.execPath;
    executableArgs = [npmCli, ...npmArgs];
  }
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status === null || result.status > 1) {
    throw new AuditPolicyError(
      "audit_execution_failed",
      String(result.error?.message || result.stderr || `npm audit exited ${result.status}`).trim(),
    );
  }
  const report = (() => {
    try {
      return JSON.parse(String(result.stdout || ""));
    } catch {
      throw new AuditPolicyError("audit_output_invalid", "npm audit did not return valid JSON");
    }
  })();
  if (report?.error) {
    throw new AuditPolicyError("audit_registry_error", String(report.error.summary || report.error.code || "unknown npm audit error"));
  }
  return report;
}

function validateReport(report, label) {
  if (report?.auditReportVersion !== 2 || !report.vulnerabilities || typeof report.vulnerabilities !== "object") {
    throw new AuditPolicyError("audit_report_unsupported", `${label} must use npm audit report version 2`);
  }
  return report;
}

function highOrCriticalEntries(report) {
  return Object.entries(report.vulnerabilities)
    .filter(([, vulnerability]) => (severityRank[vulnerability?.severity] ?? -1) >= severityRank.high)
    .sort(([left], [right]) => left.localeCompare(right));
}

function extractAdvisoryId(via) {
  const text = `${via?.url || ""} ${via?.title || ""}`;
  return text.match(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i)?.[0]?.toUpperCase() || null;
}

function rootAdvisories(report, packageName, seen = new Set()) {
  if (seen.has(packageName)) return [];
  seen.add(packageName);
  const vulnerability = report.vulnerabilities[packageName];
  if (!vulnerability || !Array.isArray(vulnerability.via)) return [];
  const roots = [];
  for (const via of vulnerability.via) {
    if (typeof via === "string") {
      roots.push(...rootAdvisories(report, via, new Set(seen)));
      continue;
    }
    const advisoryId = extractAdvisoryId(via);
    if (advisoryId) {
      roots.push({
        advisoryId,
        package: String(via.name || packageName),
        severity: String(via.severity || vulnerability.severity || "").toLowerCase(),
      });
    }
  }
  return [...new Map(roots.map((rootAdvisory) => [`${rootAdvisory.advisoryId}:${rootAdvisory.package}`, rootAdvisory])).values()];
}

function validatePolicy(policy, now) {
  if (policy?.schemaVersion !== "nexid-enterprise-npm-audit-allowlist/v1" || policy?.policyVersion !== 1) {
    throw new AuditPolicyError("allowlist_schema_invalid", "only the reviewed v1 allowlist schema is accepted");
  }
  if (!Array.isArray(policy.entries)) throw new AuditPolicyError("allowlist_schema_invalid", "entries must be an array");
  const seen = new Set();
  return policy.entries.map((entry, index) => {
    const key = `${entry?.advisoryId}:${entry?.package}`;
    if (!/^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/i.test(entry?.advisoryId || "")) {
      throw new AuditPolicyError("allowlist_entry_invalid", `entry ${index} requires an exact GHSA identifier`);
    }
    if (seen.has(key)) throw new AuditPolicyError("allowlist_entry_duplicate", key);
    seen.add(key);
    if (!entry.package || !["high", "critical"].includes(entry.severity)) {
      throw new AuditPolicyError("allowlist_entry_invalid", `${key} requires package and high/critical severity`);
    }
    if (entry.dependencyScope !== "development-only") {
      throw new AuditPolicyError("allowlist_scope_invalid", `${key} must be development-only`);
    }
    if (!Array.isArray(entry.affectedPackages) || !entry.affectedPackages.includes(entry.package)) {
      throw new AuditPolicyError("allowlist_entry_invalid", `${key} must enumerate affectedPackages including its root package`);
    }
    if (entry.owner !== "platform-security" || typeof entry.rationale !== "string" || entry.rationale.length < 80) {
      throw new AuditPolicyError("allowlist_governance_invalid", `${key} requires an owner and actionable rationale`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn || "")) {
      throw new AuditPolicyError("allowlist_expiry_invalid", `${key} requires expiresOn in YYYY-MM-DD form`);
    }
    const expiresAfter = new Date(`${entry.expiresOn}T23:59:59.999Z`);
    if (Number.isNaN(expiresAfter.getTime()) || now.getTime() > expiresAfter.getTime()) {
      throw new AuditPolicyError("allowlist_expired", `${key} expired on ${entry.expiresOn}`);
    }
    return { ...entry, advisoryId: entry.advisoryId.toUpperCase(), key };
  });
}

function enforceProductionAudit(report) {
  const findings = highOrCriticalEntries(report);
  if (findings.length) {
    throw new AuditPolicyError(
      "production_dependency_vulnerability",
      findings.map(([packageName, vulnerability]) => `${packageName}:${vulnerability.severity}`).join(", "),
    );
  }
}

function enforceFullAudit(report, allowlist) {
  const findings = highOrCriticalEntries(report);
  const usedAllowlistKeys = new Set();
  const blocked = [];
  for (const [packageName, vulnerability] of findings) {
    const roots = rootAdvisories(report, packageName);
    if (!roots.length) {
      blocked.push(`${packageName}:${vulnerability.severity}:no_exact_GHSA`);
      continue;
    }
    for (const rootAdvisory of roots) {
      const match = allowlist.find((entry) => entry.advisoryId === rootAdvisory.advisoryId
        && entry.package === rootAdvisory.package
        && entry.severity === rootAdvisory.severity
        && entry.affectedPackages.includes(packageName));
      if (!match) {
        blocked.push(`${packageName}:${vulnerability.severity}:${rootAdvisory.advisoryId}`);
      } else {
        usedAllowlistKeys.add(match.key);
      }
    }
  }
  if (blocked.length) throw new AuditPolicyError("unapproved_dependency_vulnerability", blocked.join(", "));
  const stale = allowlist.filter((entry) => !usedAllowlistKeys.has(entry.key));
  if (stale.length) {
    throw new AuditPolicyError("stale_allowlist_entry", stale.map((entry) => entry.key).join(", "));
  }
  return { findings, usedAllowlistKeys };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const policy = validatePolicy(readJson(args.policyPath, "allowlist"), args.now);
  const productionReport = validateReport(
    args.productionReportPath ? readJson(args.productionReportPath, "production audit fixture") : runNpmAudit(["--omit=dev"]),
    "production audit",
  );
  const fullReport = validateReport(
    args.fullReportPath ? readJson(args.fullReportPath, "full audit fixture") : runNpmAudit([]),
    "full audit",
  );
  enforceProductionAudit(productionReport);
  const result = enforceFullAudit(fullReport, policy);
  const summarized = result.findings.map(([packageName, vulnerability]) => `${packageName}:${vulnerability.severity}`);
  console.log(JSON.stringify({
    ok: true,
    gate: "enterprise_dependency_audit_v1",
    productionHighCritical: 0,
    temporarilyAllowlistedDevelopmentFindings: summarized,
    allowlistExpiresOn: policy.map((entry) => entry.expiresOn),
  }));
} catch (error) {
  const safeMessage = error instanceof AuditPolicyError ? error.message : "unexpected_dependency_audit_failure";
  console.error(`Enterprise dependency audit failed closed: ${safeMessage}`);
  process.exitCode = 1;
}
