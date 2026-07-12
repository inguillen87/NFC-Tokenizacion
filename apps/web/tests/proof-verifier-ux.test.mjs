import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("proof verifier keeps the enterprise decoder readable and non-trapped", async () => {
  const page = await readFile(new URL("../src/app/proof/verify/page.tsx", import.meta.url), "utf8");
  const focusTarget = await readFile(new URL("../src/app/proof/verify/proof-focus-target.tsx", import.meta.url), "utf8");
  const backLink = await readFile(new URL("../src/components/back-link.tsx", import.meta.url), "utf8");

  assert.match(page, /proof-secondary-cta/);
  assert.match(page, /Que entiende un gerente sin leer blockchain/);
  assert.match(page, /Decodificar Raw input/);
  assert.match(page, /Abrir receipt tx donde esta el memo/);
  assert.match(page, /Abrir tx con memo en IOTA Explorer/);
  assert.match(page, /Traducir Raw input a negocio/);
  assert.match(page, /Explorer Decoder para C-level/);
  assert.match(page, /Raw input = memo publico/);
  assert.match(page, /nexID lo traduce a negocio/);
  assert.match(page, /Ver campos decodificados para auditoria/);
  assert.match(page, /Abrir tx con memo real/);
  assert.match(page, /Donde esta el memo en la blockchain/);
  assert.match(page, /Transaction details - Raw input/);
  assert.match(page, /proof-exec-readout-grid/);
  assert.match(page, /proof-exec-readout-card/);
  assert.match(page, /proof-explorer-proof-path/);
  assert.match(page, /explorerProofPath/);
  assert.match(page, /Memo en Raw input confirmado/);
  assert.match(page, /proof-decoder-code/);
  assert.match(page, /proof-field-details/);
  assert.match(page, /proof-nav-cta/);
  assert.match(page, /PROOF_API_FALLBACK_URL = "https:\/\/api\.nexid\.lat"/);
  assert.match(page, /FALLBACK_PUBLIC_PROOF_DEMO_CASES/);
  assert.match(page, /Secure Delivery public proof receipt/);
  assert.match(page, /Pharma Cold Chain public proof receipt/);
  assert.match(page, /Agro Stewardship public proof receipt/);
  assert.match(page, /FALLBACK_PUBLIC_PROOF_DEMO_RESPONSE/);
  assert.match(page, /function proofApiBases/);
  assert.match(page, /fetchProofApiJson/);
  assert.match(page, /!response\.data\.cases\?\.length/);
  assert.match(page, /decodeProofInputLocally/);
  assert.match(page, /hexToUtf8/);
  assert.match(page, /parseProofMemoFields/);
  assert.match(page, /findFallbackDemoCase/);
  assert.match(page, /localResult\.ok \? localResult : response\.data/);
  assert.match(page, /const guidedDemo = activeDemo/);
  assert.match(page, /const decoderInput = requestedDecoderInput/);
  assert.match(page, /return \[configuredApiUrl \|\| PROOF_API_FALLBACK_URL\]/);
  assert.match(page, /proof-shell/);
  assert.match(page, /proof-hero-grid/);
  assert.match(page, /proof-fast-path/);
  assert.match(page, /proof-verification-console/);
  assert.match(page, /Consola de verificacion publica/);
  assert.match(page, /Un veredicto legible antes del detalle tecnico/);
  assert.match(page, /proof-console-card--success/);
  assert.match(page, /proof-console-card--warning/);
  assert.match(page, /proof-console-card--info/);
  assert.match(page, /Abrir receipt tx con Raw input/);
  assert.match(page, /proof-mobile-demo-actions/);
  assert.match(page, /Probar SHA demo/);
  assert.match(page, /Leer memo real/);
  assert.match(page, /proof-fast-path-card__headline/);
  assert.match(page, /Arranque guiado/);
  assert.match(page, /Proba un proof completo sin saber blockchain/);
  assert.match(page, /Verificar SHA demo/);
  assert.match(page, /Decodificar memo/);
  assert.match(page, /Caso demo sugerido/);
  assert.match(page, /Cargar SHA de este caso/);
  assert.match(page, /proof-topbar/);
  assert.match(page, /proof-top-actions/);
  assert.match(page, /proof-top-cta/);
  assert.match(page, /proof-top-cta--sdk/);
  assert.match(page, /proof-explorer-link/);
  assert.match(page, /min-height:\s*2\.75rem/);
  assert.match(page, /grid-column:\s*1\s*\/\s*-1/);
  assert.match(page, /theme-toggle span:not\(\.theme-toggle__glyph\)/);
  assert.match(page, /max-w-\[1540px\]/);
  assert.match(page, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(page, /\.proof-shell > \*/);
  assert.match(page, /order:\s*10/);
  assert.match(page, /\.proof-hero-grid\s*\{[\s\S]*order:\s*1/);
  assert.match(page, /\.proof-fast-path\s*\{[\s\S]*order:\s*2/);
  assert.match(page, /\.proof-architecture-disclosure\s*\{[\s\S]*order:\s*3/);
  assert.match(page, /\.proof-verification-console\s*\{[\s\S]*order:\s*4/);
  assert.match(page, /\.proof-workstation-grid\s*\{[\s\S]*order:\s*5/);
  assert.match(page, /\.proof-fast-path-card__headline\s*\{[\s\S]*-webkit-line-clamp:\s*2/);
  assert.match(page, /proof-workstation-grid\s*>\s*\*/);
  assert.match(page, /min-width:\s*0/);
  assert.match(page, /proof-workstation-result-panel/);
  assert.match(page, /proof-executive-panel/);
  assert.match(page, /proof-result-status-chip/);
  assert.match(page, /\.proof-result-status-chip\s*\{[\s\S]*flex-shrink:\s*0/);
  assert.match(page, /\.proof-result-status-chip\s*\{[\s\S]*min-width:\s*6\.25rem/);
  assert.match(page, /\.proof-result-status-chip\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(page, /@media \(min-width:\s*1180px\)/);
  assert.match(page, /grid-template-columns:\s*minmax\(0,\s*0\.88fr\) minmax\(28rem,\s*1\.12fr\)/);
  assert.match(page, /proof-workstation-result-panel,[\s\S]*proof-workstation-sidebar[\s\S]*align-self:\s*start/);
  assert.match(page, /proof-decoder-panel/);
  assert.match(page, /decoderWarnings/);
  assert.match(page, /decoderNeedsReview/);
  assert.match(page, /Memo parseado, origen no verificado/);
  assert.match(page, /Recibo demo \+ tx verificados/);
  assert.match(page, /Recibo conocido, tx no disponible/);
  assert.match(page, /receipt_publication_unavailable/);
  assert.match(page, /receipt_verified/);
  assert.match(page, /verification_status/);
  assert.match(page, /Fixture testnet confirmado/);
  assert.match(page, /Anclaje externo confirmado/);
  assert.match(page, /Anchor enviado, aun no confirmado/);
  assert.match(page, /#proof-result/);
  assert.match(page, /#proof-decoder/);
  assert.match(page, /proof-architecture-disclosure/);
  assert.match(page, /architectureRequested/);
  assert.match(page, /\/proof\/ownership/);
  assert.match(page, /ProofFocusTarget/);
  assert.match(page, /tabIndex=\{-1\}/);
  assert.match(focusTarget, /scrollIntoView/);
  assert.match(focusTarget, /focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /proof-decoder-warning-panel/);
  assert.match(page, /Observaciones del decoder/);
  assert.match(page, /verification_steps/);
  assert.match(page, /private_data_not_published/);
  assert.match(page, /Checklist de verificacion/);
  assert.match(page, /Datos privados que no se publicaron/);
  assert.match(page, /proof-manager-panel/);
  assert.match(page, /proof-decoder-translation-grid/);
  assert.match(page, /proof-manager-explain-grid/);
  assert.match(page, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(page, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(page, /Abrir anchor tx/);
  assert.match(page, /Abrir receipt tx donde esta el memo/);
  assert.match(page, /Abrir memo tx y copiar Raw input/);
  assert.match(page, /Este entorno todavia no muestra una tx publica/);
  assert.match(backLink, /aria-label=\{label\}/);
  assert.match(backLink, /ArrowLeft/);
  assert.doesNotMatch(backLink, /\{"<-"\}/);
  assert.doesNotMatch(page, /inline-flex items-center gap-2 text-xs font-black uppercase tracking-\[0\.1em\] text-cyan-800/);
  assert.doesNotMatch(page, /mt-4 inline-flex items-center gap-2 text-sm font-black text-cyan-800/);
  assert.doesNotMatch(page, /proof-workstation-sidebar\s*\{[^}]*position:\s*sticky/s);
  assert.doesNotMatch(page, /minmax\(480px,\s*540px\)/);
  assert.doesNotMatch(page, /proof-workstation-sidebar\s*\{[^}]*max-height/s);
  assert.doesNotMatch(page, /proof-workstation-sidebar\s*\{[^}]*overflow:\s*auto/s);
  assert.doesNotMatch(page, /fondear la wallet/);
  assert.doesNotMatch(page, /fund \+ deploy/);
  assert.doesNotMatch(page, /Pendiente de deploy/);
});

test("IOTA proof verdict requires anchor RPC verification", async () => {
  const page = await readFile(new URL("../src/app/proof/verify/page.tsx", import.meta.url), "utf8");
  const declaration = page.match(/const externallyConfirmed = ([\s\S]*?);/);
  assert.ok(declaration, "missing externallyConfirmed declaration");
  const externallyConfirmedExpression = declaration[1];
  assert.match(externallyConfirmedExpression, /result\?\.network_verification\?\.anchor\?\.verified\s*===\s*true/);
  assert.doesNotMatch(externallyConfirmedExpression, /result\?\.(?:valid|externally_confirmed)/);
});

test("IOTA decoder verdict requires receipt RPC verification", async () => {
  const page = await readFile(new URL("../src/app/proof/verify/page.tsx", import.meta.url), "utf8");
  const declaration = page.match(/const decoderReceiptVerified = ([\s\S]*?);/);
  assert.ok(declaration, "missing decoderReceiptVerified declaration");
  const decoderReceiptVerifiedExpression = declaration[1];
  assert.match(decoderReceiptVerifiedExpression, /decodedProof\?\.network_verification\?\.verified\s*===\s*true/);
  assert.doesNotMatch(decoderReceiptVerifiedExpression, /decodedProof\?\.receipt_verified/);
});

test("IOTA receipt confirmation badge requires receipt RPC verification", async () => {
  const page = await readFile(new URL("../src/app/proof/verify/page.tsx", import.meta.url), "utf8");
  const guidedReceiptChip = page.match(
    /\{([^{}\n]+)\?\s*\(\s*<span className="proof-receipt-status-chip[\s\S]{0,400}?Memo en Raw input confirmado[\s\S]{0,200}?<\/span>/,
  );
  assert.ok(guidedReceiptChip, "guided receipt confirmation badge must exist");
  assert.match(guidedReceiptChip[1], /guidedDemo\.network_verification\?\.receipt\?\.verified\s*===\s*true/);
  assert.doesNotMatch(guidedReceiptChip[1], /guidedDemo\.public_receipt\.tx_hash/);
});

test("IOTA verified receipt CTA requires receipt RPC verification", async () => {
  const page = await readFile(new URL("../src/app/proof/verify/page.tsx", import.meta.url), "utf8");
  const verifiedReceiptLink = page.match(
    /\{([^{}\n]+)\?\s*\(\s*<a href=\{decodedProof\.publication_explorer_url\}[\s\S]{0,400}?Abrir tx verificada del recibo/,
  );
  assert.ok(verifiedReceiptLink, "verified receipt CTA must exist");
  assert.match(verifiedReceiptLink[1], /(?:decoderReceiptVerified|decodedProof\?\.network_verification\?\.verified\s*===\s*true)/);
  assert.match(verifiedReceiptLink[1], /decodedProof\?\.publication_explorer_url/);
});

test("IOTA overview confirmation labels use RPC fields", async () => {
  const page = await readFile(new URL("../src/app/proof/verify/page.tsx", import.meta.url), "utf8");
  assert.match(page, /demoCatalog\.testnet\?\.iota\?\.rpc_verified\s*\?\s*"RPC verified"/);
  assert.match(page, /demoCase\.network_verification\?\.anchor\?\.verified\s*\?\s*"IOTA anchor RPC confirmado"/);
  assert.match(page, /demoCase\.network_verification\?\.receipt\?\.verified\s*\?\s*"Memo RPC confirmado en IOTA"/);
});

test("executive IOTA explorer actions keep receipt data separate from the anchor call", async () => {
  const page = await readFile(new URL("../src/app/proof/verify/page.tsx", import.meta.url), "utf8");

  const declaration = (name) => {
    const match = page.match(new RegExp(`const ${name} = ([\\s\\S]*?);`));
    assert.ok(match, `missing ${name} declaration`);
    return match[1];
  };

  const decodedReceiptExpression = declaration("decodedReceiptExplorerUrl");
  const receiptExpression = declaration("receiptExplorerUrl");
  const anchorExpression = declaration("anchorExplorerUrl");

  assert.match(page, /const decodedReceiptMatchesQuery = Boolean\(/);
  assert.match(page, /decodedDemoCase\.primary_event_hash\.toLowerCase\(\) === eventHash\.toLowerCase\(\)/);
  assert.match(page, /decodedDemoCase\.anchor_id\.toLowerCase\(\) === anchorId\.toLowerCase\(\)/);
  assert.match(decodedReceiptExpression, /decodedReceiptMatchesQuery/);
  assert.match(decodedReceiptExpression, /decodedProof\?\.publication_explorer_url/);
  assert.match(receiptExpression, /decodedReceiptExplorerUrl/);
  assert.match(receiptExpression, /guidedDemo\?\.public_receipt\?\.explorer_url/);
  assert.doesNotMatch(receiptExpression, /matches\.find|guidedDemo\?\.explorer_url/);
  assert.match(anchorExpression, /matches\.find/);
  assert.match(anchorExpression, /guidedDemo\?\.explorer_url/);
  assert.doesNotMatch(anchorExpression, /public_receipt|publication_explorer_url/);

  const consoleStart = page.indexOf('<section className="proof-verification-console');
  const consoleEnd = page.indexOf('<section id="proof-result"', consoleStart);
  assert.ok(consoleStart >= 0 && consoleEnd > consoleStart, "verification console should be present");
  const executiveConsole = page.slice(consoleStart, consoleEnd);

  assert.match(executiveConsole, /data-proof-explorer="receipt" href=\{receiptExplorerUrl\}/);
  assert.match(executiveConsole, /Abrir receipt tx con Raw input/);
  assert.match(executiveConsole, /data-proof-explorer="anchor" href=\{separateAnchorExplorerUrl\}/);
  assert.match(executiveConsole, /Abrir anchor tx \(Merkle root\)/);
  assert.doesNotMatch(executiveConsole, /data-proof-explorer="receipt" href=\{(?:anchorExplorerUrl|separateAnchorExplorerUrl)\}/);
  assert.match(page, /no se presenta como memo legible/);
  assert.match(page, /no el contract call del anchor/);
  assert.match(page, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(page, /const externalExplorerUrl/);
});
