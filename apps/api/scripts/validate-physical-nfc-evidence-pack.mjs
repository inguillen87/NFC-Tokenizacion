import { validatePhysicalNfcEvidencePack } from "./lib/physical-nfc-evidence-pack.mjs";

function argumentValue(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: npm run supplier:physical-evidence:validate -- --pack=<sanitized-evidence-directory>");
  process.exit(0);
}

const packDirectory = argumentValue("--pack");
if (!packDirectory) {
  console.error(JSON.stringify({ ok: false, reason: "physical_evidence_pack_directory_required" }));
  process.exit(2);
}

try {
  const result = await validatePhysicalNfcEvidencePack(packDirectory);
  console.log(JSON.stringify(result, null, process.argv.includes("--pretty") ? 2 : 0));
  if (!result.ok) process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ ok: false, reason: "physical_evidence_pack_validation_failed" }));
  process.exitCode = 1;
}
