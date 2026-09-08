import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dir = new URL("../src/app/me/_components/", import.meta.url);
const clientSource = readFileSync(new URL("wallet-interactive-client.tsx", dir), "utf8");
const modelSource = readFileSync(new URL("consumer-home-model.ts", dir), "utf8");

function compile(source, overrides = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const homeModel = compile(modelSource);
function render(products, demo = false) {
  const previous = process.env.NEXT_PUBLIC_WALLET_TRANSFER_DEMO_ENABLED;
  process.env.NEXT_PUBLIC_WALLET_TRANSFER_DEMO_ENABLED = demo ? "true" : "false";
  const links = [];
  try {
    const { WalletInteractiveClient } = compile(clientSource, {
      "./consumer-home-model": homeModel,
      "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { links.push({ prefetch, ...props }); return React.createElement("a", props, children); } },
    });
    const html = renderToStaticMarkup(React.createElement(WalletInteractiveClient, { initialProducts: products, selectedTenant: "actual-brand" }));
    return { html, links };
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_WALLET_TRANSFER_DEMO_ENABLED;
    else process.env.NEXT_PUBLIC_WALLET_TRANSFER_DEMO_ENABLED = previous;
  }
}

const product = (overrides = {}) => ({ product_name: "Producto real", bid: "LOTE-1", ownership_record_status: "viewed", ...overrides });

test("wallet opens the latest associated reading privately instead of an unsigned public certificate", () => {
  const { html, links } = render([product({ latest_tap_event_id: "703", first_tap_event_id: "702" })]);
  assert.match(html, /Abrir lectura/);
  assert.equal(links.length, 1);
  assert.equal(links[0].href, "/me/taps/703");
  assert.equal(links[0].prefetch, false);
  assert.doesNotMatch(html, /href="\/certificado\/|Firma digital/);
  assert.match(clientSource, /import \{ homeReadingHref \} from "\.\/consumer-home-model"/);
});

test("wallet falls back to an explicitly reported first reading only when the latest reference is unusable", () => {
  for (const latest of [null, undefined, "", "invalid", "01", 0]) {
    const { links } = render([product({ latest_tap_event_id: latest, first_tap_event_id: 701 })]);
    assert.equal(links[0].href, "/me/taps/701");
  }
});

test("wallet preserves canonical bigint IDs and suppresses unsafe, malformed and absent reading actions", () => {
  for (const id of ["9007199254740993", "9223372036854775807"]) {
    const { links } = render([product({ latest_tap_event_id: id })]);
    assert.equal(links[0].href, `/me/taps/${id}`);
  }
  for (const id of [null, undefined, "", "01", "+1", " 703 ", "703\n", "9223372036854775808", Number.MAX_SAFE_INTEGER + 1, "/me/privacy", "1?share=private"]) {
    const { html, links } = render([product({ latest_tap_event_id: id })]);
    assert.equal(links.length, 0, String(id));
    assert.doesNotMatch(html, /Abrir lectura|href="\/me\/taps\/|href="\/certificado\//);
  }
});

test("private reading access does not enable transfer or alter claimed ownership controls", () => {
  const { html, links } = render([product({ latest_tap_event_id: 703, ownership_record_status: "claimed" })]);
  assert.match(html, /Transferencias deshabilitadas/);
  assert.match(html, /receipt confirmado por el backend/);
  assert.match(html, /Propietario/);
  assert.equal(links[0].href, "/me/taps/703");
  assert.doesNotMatch(html, /Simular transferencia|Confirmar|Simulación local completada/);
  assert.match(clientSource, /if \(!transferDemoEnabled\)/);
  assert.match(clientSource, /isClaimed && !isTransferred && transferDemoEnabled/);
  assert.match(clientSource, /No se firmó, envió ni confirmó una transacción y el ownership real no cambió/);
});

test("the explicit local transfer demo remains labelled and never changes a reading destination", () => {
  const claimed = render([product({ latest_tap_event_id: 703, ownership_record_status: "claimed" })], true);
  assert.match(claimed.html, /DEMO DE TRANSFERENCIA/);
  assert.match(claimed.html, /Simular transferencia/);
  assert.equal(claimed.links[0].href, "/me/taps/703");
  const unclaimed = render([product({ latest_tap_event_id: 703 })], true);
  assert.doesNotMatch(unclaimed.html, /Simular transferencia/);
  assert.doesNotMatch(clientSource, /window\.ethereum|eth_sendTransaction|eth_sign|personal_sign|fetch\(/);
});

test("existing explorer evidence stays separate from the private reading and rejects demo hashes", () => {
  const txHash = `0x${"1".repeat(64)}`;
  const real = render([product({ latest_tap_event_id: 703, tokenization_status: "anchored", tokenization_tx_hash: txHash })]);
  assert.match(real.html, new RegExp(`href="https://amoy\\.polygonscan\\.com/tx/${txHash}"`));
  assert.equal(real.links[0].href, "/me/taps/703");
  const demo = render([product({ latest_tap_event_id: 703, tokenization_status: "anchored", tokenization_tx_hash: "DEMO-HASH" })]);
  assert.doesNotMatch(demo.html, /href="https:\/\/amoy\.polygonscan/);
  assert.equal(demo.links[0].href, "/me/taps/703");
});
