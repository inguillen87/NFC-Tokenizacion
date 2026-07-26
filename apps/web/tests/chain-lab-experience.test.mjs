import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildChainLabViewModel,
  safeHttpUrl,
} from "../src/app/(public)/demo-lab/chains/chain-lab-model.mjs";

function verifiedFixture() {
  const iotaCase = (id) => ({
    id,
    title: `Caso ${id}`,
    headline: "Evidencia de cadena de suministro",
    primary_event_hash: `sha256:event-${id}`,
    merkle_root: `sha256:root-${id}`,
    tx_hash: `0xanchor-${id}`,
    explorer_url: `https://explorer.evm.testnet.iota.cafe/tx/0xanchor-${id}`,
    network_verification: {
      anchor: { verified: true },
      receipt: { verified: true },
    },
    public_receipt: {
      business_claim: "Demuestra integridad sin publicar el dato privado.",
      tx_hash: `0xreceipt-${id}`,
      explorer_url: `https://explorer.evm.testnet.iota.cafe/tx/0xreceipt-${id}`,
    },
  });

  return {
    catalog: {
      ok: true,
      privacy: "No customer, route manifest, UID or private key is exposed.",
      cases: [iotaCase("agro"), iotaCase("delivery")],
      testnet: {
        iota: {
          network: "iota_evm_testnet",
          rpc_configured: true,
          contract_configured: true,
          rpc_verified: true,
          contract_address: "0x1111111111111111111111111111111111111111",
          contract_explorer_url: "https://explorer.evm.testnet.iota.cafe/address/0x1111111111111111111111111111111111111111",
          demo_tx_hash: "0xanchor-agro",
          demo_tx_explorer_url: "https://explorer.evm.testnet.iota.cafe/tx/0xanchor-agro",
        },
        polygon: {
          network: "amoy",
          rpc_configured: true,
          contract_configured: true,
          rpc_verified: true,
          verification_state: "confirmed",
          contract_address: "0x2222222222222222222222222222222222222222",
          owner_address: "0x3333333333333333333333333333333333333333",
          owner_custody: "buyer_wallet",
          wallet_control_verified: true,
          claim_state: "buyer_controlled",
          contract_explorer_url: "https://amoy.polygonscan.com/address/0x2222222222222222222222222222222222222222",
          owner_explorer_url: "https://amoy.polygonscan.com/address/0x3333333333333333333333333333333333333333",
          demo_tx_hash: "0xpolygon-mint",
          demo_tx_explorer_url: "https://amoy.polygonscan.com/tx/0xpolygon-mint",
          demo_token_id: "20",
          metadata_url: "https://api.nexid.lat/public/polygon/metadata/ownership-v2",
          metadata_verified: true,
          mint_events_match: true,
          source_verified: true,
        },
      },
    },
    certificate: {
      ok: true,
      verification_state: "confirmed",
      network: "polygon-amoy",
      contract_address: "0x2222222222222222222222222222222222222222",
      token_id: "20",
      owner: {
        address: "0x3333333333333333333333333333333333333333",
        custody: "buyer_wallet",
        wallet_control_verified: true,
      },
      mint: { tx_hash: "0xpolygon-mint", events_match: true },
      claim: { state: "buyer_controlled", events_match: true },
      checks: [
        { id: "mint", ok: true },
        { id: "owner", ok: true },
        { id: "metadata", ok: true },
      ],
      links: {
        transaction_explorer: "https://amoy.polygonscan.com/tx/0xpolygon-mint",
      },
    },
    sources: {
      catalog: { ok: true, status: 200, error: null },
      certificate: { ok: true, status: 200, error: null },
    },
    observedAt: "2026-07-26T12:00:00.000Z",
  };
}

test("chain lab only marks both networks verified when critical live evidence is complete", () => {
  const model = buildChainLabViewModel(verifiedFixture());

  assert.equal(model.status.code, "verified");
  assert.equal(model.chains.iota.status.code, "verified");
  assert.equal(model.chains.polygon.status.code, "verified");
  assert.equal(model.chains.iota.samples.length, 2);
  assert.equal(model.chains.iota.samples[0].state, "verified");
  assert.match(model.chains.polygon.headline, /wallet compradora/i);
  assert.equal(model.sources.warnings.length, 0);
});

test("IOTA cannot become verified from a top-level flag when a receipt is missing", () => {
  const fixture = verifiedFixture();
  fixture.catalog.cases[1].network_verification.receipt.verified = false;
  const model = buildChainLabViewModel(fixture);

  assert.equal(fixture.catalog.testnet.iota.rpc_verified, true);
  assert.equal(model.chains.iota.status.code, "partial");
  assert.equal(model.chains.iota.checks.find((item) => item.id === "iota-receipts")?.state, "warn");
  assert.notEqual(model.status.code, "verified");
});

test("IOTA receipt flags without a public hash and HTTPS explorer remain partial", () => {
  const fixture = verifiedFixture();
  fixture.catalog.cases[0].public_receipt = {};
  const model = buildChainLabViewModel(fixture);

  assert.equal(model.chains.iota.status.code, "partial");
  assert.equal(model.chains.iota.samples[0].state, "partial");
  assert.equal(model.chains.iota.samples[0].receiptHash, null);
  assert.equal(model.chains.iota.samples[0].receiptExplorerUrl, null);
});

test("Polygon cannot become verified when metadata or public transaction evidence is missing", () => {
  const fixture = verifiedFixture();
  fixture.catalog.testnet.polygon.metadata_verified = false;
  fixture.catalog.testnet.polygon.demo_tx_explorer_url = "";
  fixture.certificate.links.transaction_explorer = "";
  const model = buildChainLabViewModel(fixture);

  assert.equal(fixture.catalog.testnet.polygon.rpc_verified, true);
  assert.equal(model.chains.polygon.status.code, "partial");
  assert.equal(model.chains.polygon.checks.find((item) => item.id === "polygon-metadata")?.state, "warn");
  assert.equal(model.chains.polygon.actions.secondary, null);
});

test("Polygon never combines a different certificate contract, network or token into a verified proof", () => {
  const fixture = verifiedFixture();
  fixture.certificate.contract_address = "0x4444444444444444444444444444444444444444";
  fixture.certificate.network = "polygon-mainnet";
  fixture.certificate.token_id = "999";
  const model = buildChainLabViewModel(fixture);

  assert.equal(model.chains.polygon.status.code, "partial");
  assert.equal(model.chains.polygon.checks.find((item) => item.id === "polygon-certificate")?.state, "warn");
});

test("Polygon requires certificate contract and network before correlating public sources", () => {
  const missingContract = verifiedFixture();
  delete missingContract.certificate.contract_address;
  assert.equal(buildChainLabViewModel(missingContract).chains.polygon.status.code, "partial");

  const missingNetwork = verifiedFixture();
  delete missingNetwork.certificate.network;
  assert.equal(buildChainLabViewModel(missingNetwork).chains.polygon.status.code, "partial");
});

test("failed critical sources downgrade otherwise green payloads", () => {
  const fixture = verifiedFixture();
  fixture.sources.catalog = { ok: false, status: 503, error: "rpc_unavailable" };
  const model = buildChainLabViewModel(fixture);

  assert.equal(model.chains.iota.status.code, "partial");
  assert.equal(model.chains.polygon.status.code, "partial");
  assert.notEqual(model.status.code, "verified");
});

test("unavailable sources stay unavailable and never produce invented explorer links", () => {
  const model = buildChainLabViewModel({
    catalog: null,
    certificate: null,
    sources: {
      catalog: { ok: false, status: 0, error: "timeout_or_network_error" },
      certificate: { ok: false, status: 503, error: "rpc_unavailable" },
    },
    observedAt: "2026-07-26T12:00:00.000Z",
  });

  assert.equal(model.status.code, "unavailable");
  assert.equal(model.chains.iota.status.code, "unavailable");
  assert.equal(model.chains.polygon.status.code, "unavailable");
  assert.deepEqual(model.chains.iota.evidence, []);
  assert.deepEqual(model.chains.polygon.evidence, []);
  assert.equal(model.sources.warnings.length, 2);
  assert.match(model.environmentNotice, /parcial, configurado o no disponible no constituyen confirmacion/);
});

test("public explorer links are restricted to HTTPS", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("http://amoy.polygonscan.com/tx/1"), null);
  assert.equal(safeHttpUrl("not-a-url"), null);
  assert.equal(safeHttpUrl("https://amoy.polygonscan.com/tx/1"), "https://amoy.polygonscan.com/tx/1");
});

test("chain lab route is guided, truthful, retryable and connected to existing public verifiers", async () => {
  const [page, client, modelSource, css, demoLab, sitemap] = await Promise.all([
    readFile(new URL("../src/app/(public)/demo-lab/chains/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(public)/demo-lab/chains/chain-lab-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(public)/demo-lab/chains/chain-lab-model.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(public)/demo-lab/chains/chain-lab.module.css", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/sitemap.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /PUBLIC_CHAIN_FETCH_TIMEOUT_MS = 6_000/);
  assert.match(page, /cache: "no-store"/);
  assert.match(page, /AbortSignal\.timeout\(PUBLIC_CHAIN_FETCH_TIMEOUT_MS\)/);
  assert.match(page, /loadPublicSource\("\/public\/proof\/demo-cases"\)/);
  assert.match(page, /loadPublicSource\("\/public\/polygon\/ownership"\)/);
  assert.match(page, /Promise\.all/);
  assert.match(page, /timeout_or_network_error/);

  assert.match(client, /const STEPS = \[/);
  assert.match(client, /Que queres probar/);
  assert.match(client, /Que hace cada red/);
  assert.match(client, /Que respondio hoy/);
  assert.match(client, /Abrir la prueba/);
  assert.match(client, /consulta de evidencia en redes de prueba/);
  assert.match(page, /verificada, parcial o no disponible/);
  assert.match(client, /Esto no es produccion ni una promesa legal/);
  assert.match(client, /Los estados verdes requieren comprobaciones RPC/);
  assert.match(client, /El laboratorio no muestra links inventados/);
  assert.match(client, /No prueba por si solo/);
  assert.match(client, /aria-live="polite"/);
  assert.match(client, /router\.refresh\(\)/);
  assert.match(modelSource, /\/proof\/verify\?layer=iota#iota-proof/);
  assert.match(modelSource, /\/proof\/ownership/);
  assert.match(client, /Custodia y autorizacion productiva auditadas; este laboratorio no las expone/);
  assert.doesNotMatch(client, /signer_configured/);

  assert.match(demoLab, /href="\/demo-lab\/chains"/);
  assert.match(demoLab, /Abrir Chain Lab IOTA \+ Polygon/);
  assert.match(sitemap, /path: "\/demo-lab\/chains"/);

  assert.match(css, /:global\(html\[data-theme="light"\]\) \.page/);
  assert.match(css, /\.page a:focus-visible/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
