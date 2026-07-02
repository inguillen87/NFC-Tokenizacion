import { createHash } from "node:crypto";

export const PUBLIC_PROOF_DEMO_SEEDS = [
  {
    id: "secure-delivery",
    anchor_id: "11111111-1111-4111-8111-111111111111",
    resource_type: "secure_delivery_pack",
    resource_id: "SDL-AR-2026-0007",
    events: [
      {
        event_type: "seal_applied",
        payload: {
          batch_code: "SDL-AR-2026-0007",
          control_policy: "tamper_seal_required",
          channel: "enterprise_delivery",
          seal_state: "applied",
          proof_version: 1,
        },
      },
      {
        event_type: "custody_transfer",
        payload: {
          batch_code: "SDL-AR-2026-0007",
          from_step: "warehouse",
          to_step: "last_mile",
          integrity_check: "seal_intact",
          proof_version: 1,
        },
      },
      {
        event_type: "recipient_verified",
        payload: {
          batch_code: "SDL-AR-2026-0007",
          delivery_result: "accepted",
          seal_state: "intact",
          claim_window: "available",
          proof_version: 1,
        },
      },
    ],
  },
  {
    id: "pharma-cold-chain",
    anchor_id: "22222222-2222-4222-8222-222222222222",
    resource_type: "pharma_batch",
    resource_id: "PHR-LOT-2026-0142",
    events: [
      {
        event_type: "qa_batch_release",
        payload: {
          batch_code: "PHR-LOT-2026-0142",
          qa_result: "released",
          temperature_band_c: "2-8",
          serialization_level: "case_and_unit",
          proof_version: 1,
        },
      },
      {
        event_type: "cold_chain_checkpoint",
        payload: {
          batch_code: "PHR-LOT-2026-0142",
          checkpoint: "regional_hub",
          temperature_band_c: "2-8",
          excursion_detected: false,
          proof_version: 1,
        },
      },
      {
        event_type: "tamper_review",
        payload: {
          batch_code: "PHR-LOT-2026-0142",
          seal_state: "intact",
          recall_flag: false,
          dpp_export: "ready",
          proof_version: 1,
        },
      },
    ],
  },
  {
    id: "agro-stewardship",
    anchor_id: "33333333-3333-4333-8333-333333333333",
    resource_type: "agro_input_batch",
    resource_id: "AGR-STW-2026-0031",
    events: [
      {
        event_type: "origin_attested",
        payload: {
          batch_code: "AGR-STW-2026-0031",
          channel_policy: "authorized_distribution",
          stewardship_program: "field_safe_use",
          proof_version: 1,
        },
      },
      {
        event_type: "field_scan",
        payload: {
          batch_code: "AGR-STW-2026-0031",
          verification_mode: "offline_then_sync",
          risk_score_band: "low",
          proof_version: 1,
        },
      },
      {
        event_type: "claim_policy_opened",
        payload: {
          batch_code: "AGR-STW-2026-0031",
          claim_path: "channel_and_tamper_review",
          counterfeit_signal: false,
          proof_version: 1,
        },
      },
    ],
  },
];

export function stableJson(input) {
  if (input === null || typeof input !== "object") return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map((item) => stableJson(item)).join(",")}]`;
  const entries = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, value]) => `${JSON.stringify(key)}:${stableJson(value)}`).join(",")}}`;
}

export function hashEvidencePayload(input) {
  return `sha256:${createHash("sha256").update(stableJson(input)).digest("hex")}`;
}

export function hashPublicText(value) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function stripShaPrefix(value) {
  return String(value || "").replace(/^sha256:/i, "").trim().toLowerCase();
}

export function buildMerkleRoot(eventHashes) {
  const leaves = eventHashes.map(stripShaPrefix).filter((hash) => /^[0-9a-f]{64}$/.test(hash));
  if (!leaves.length) throw new Error("event_hashes_required");
  let level = leaves;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      next.push(createHash("sha256").update(`${left}${right}`).digest("hex"));
    }
    level = next;
  }
  return `sha256:${level[0]}`;
}

function slug(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const RECEIPTS = {
  "secure-delivery": {
    title: "Secure Delivery public proof receipt",
    vertical: "Logistica premium",
    business_claim: "Demuestra que un paquete sellado tuvo custodia y entrega verificable sin publicar receptor ni manifiesto.",
    manager_explanation: "Para operaciones: el cliente ve una prueba externa de integridad; la empresa conserva la ruta completa, permisos y documentos en nexID.",
  },
  "pharma-cold-chain": {
    title: "Pharma Cold Chain public proof receipt",
    vertical: "Pharma regulado",
    business_claim: "Demuestra que un lote sensible tuvo liberacion QA, control frio y revision de tamper incluidos en un mismo root.",
    manager_explanation: "Para calidad/regulatorio: la prueba sirve para auditoria, DPP y reclamos sin publicar pacientes, certificados internos ni rutas privadas.",
  },
  "agro-stewardship": {
    title: "Agro Stewardship public proof receipt",
    vertical: "Agro quimico",
    business_claim: "Demuestra origen, canal autorizado, escaneo de campo y politica de reclamo para un insumo agricola.",
    manager_explanation: "Para canal y compliance: prueba stewardship y trazabilidad de uso responsable sin exponer clientes, lotes comerciales reales ni ubicaciones sensibles.",
  },
};

export function buildPublicProofDemoCases() {
  return PUBLIC_PROOF_DEMO_SEEDS.map((seed) => {
    const events = seed.events.map((event) => ({
      ...event,
      hash: hashEvidencePayload({
        tenantId: "public-demo",
        resourceType: seed.resource_type,
        resourceId: seed.resource_id,
        eventType: event.event_type,
        payload: event.payload,
      }),
    }));
    const merkleRoot = buildMerkleRoot(events.map((event) => event.hash));
    const receipt = RECEIPTS[seed.id];
    const onChainMemo = [
      "nexID-proof-v1",
      `case=${seed.id}`,
      `vertical=${slug(receipt.vertical)}`,
      `resource=${seed.resource_type}:${seed.resource_id}`,
      `events=${events.length}`,
      `root=${merkleRoot}`,
      "privacy=hash-only",
    ].join("|");
    return {
      ...seed,
      events,
      primary_event_hash: events[0]?.hash || "",
      merkle_root: merkleRoot,
      public_receipt: {
        title: receipt.title,
        business_claim: receipt.business_claim,
        manager_explanation: receipt.manager_explanation,
        on_chain_memo: onChainMemo,
        receipt_hash: hashPublicText(onChainMemo),
        tx_hash: null,
        explorer_url: null,
        public_fields: [
          "case",
          "vertical",
          "resource class",
          "event count",
          "Merkle root",
          "privacy policy",
        ],
        private_fields: [
          "UID/NFC secret material",
          "customer or patient identity",
          "route manifest",
          "internal QA documents",
          "commercial contract data",
        ],
      },
    };
  });
}
