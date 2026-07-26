import { buildMerkleRoot, hashEvidencePayload, hashPublicText } from "./proof-layer";

export type PublicProofDemoEvent = {
  id: string;
  title: string;
  event_type: string;
  hash: string;
  summary: string;
};

export type PublicProofDemoCase = {
  id: string;
  title: string;
  vertical: string;
  headline: string;
  body: string;
  primary_event_hash: string;
  anchor_id: string;
  provider: "iota";
  network: "iota-evm-testnet-ready";
  status: "demo_ready";
  merkle_root: string;
  resource_type: string;
  resource_id: string;
  anchored_at: string;
  explorer_url: null;
  tx_hash: null;
  public_receipt: {
    title: string;
    business_claim: string;
    manager_explanation: string;
    on_chain_memo: string;
    receipt_hash: string;
    tx_hash: string | null;
    explorer_url: string | null;
    public_fields: string[];
    private_fields: string[];
  };
  events: PublicProofDemoEvent[];
  proof_layers: Array<{
    layer: string;
    purpose: string;
    status: string;
  }>;
};

type DemoSeedEvent = {
  id: string;
  title: string;
  event_type: string;
  summary: string;
  resource_type: string;
  resource_id: string;
  payload: Record<string, unknown>;
};

type DemoSeed = {
  id: string;
  title: string;
  vertical: string;
  headline: string;
  body: string;
  anchor_id: string;
  resource_type: string;
  resource_id: string;
  anchored_at: string;
  events: DemoSeedEvent[];
  receipt: {
    business_claim: string;
    manager_explanation: string;
  };
  proof_layers: PublicProofDemoCase["proof_layers"];
};

const DEMO_SEEDS: DemoSeed[] = [
  {
    id: "secure-delivery",
    title: "Secure Delivery",
    vertical: "Logistica premium",
    headline: "Caja sellada, custodia y reclamo verificable sin exponer datos privados.",
    body: "Un operador puede mostrar que el paquete fue sellado, transferido y entregado con evidencia hash-only. El comprador ve integridad; la empresa conserva manifests y datos sensibles dentro de nexID.",
    anchor_id: "11111111-1111-4111-8111-111111111111",
    resource_type: "secure_delivery_pack",
    resource_id: "SDL-AR-2026-0007",
    anchored_at: "2026-07-02T12:00:00.000Z",
    events: [
      {
        id: "seal-applied",
        title: "Sello aplicado",
        event_type: "seal_applied",
        summary: "NFC 424 asignado al paquete antes de salir del deposito.",
        resource_type: "secure_delivery_pack",
        resource_id: "SDL-AR-2026-0007",
        payload: {
          batch_code: "SDL-AR-2026-0007",
          control_policy: "tamper_seal_required",
          channel: "enterprise_delivery",
          seal_state: "applied",
          proof_version: 1,
        },
      },
      {
        id: "custody-transfer",
        title: "Custodia transferida",
        event_type: "custody_transfer",
        summary: "El operador registra handoff sin publicar manifiesto ni identidad del destinatario.",
        resource_type: "secure_delivery_pack",
        resource_id: "SDL-AR-2026-0007",
        payload: {
          batch_code: "SDL-AR-2026-0007",
          from_step: "warehouse",
          to_step: "last_mile",
          integrity_check: "seal_intact",
          proof_version: 1,
        },
      },
      {
        id: "recipient-verified",
        title: "Entrega verificada",
        event_type: "recipient_verified",
        summary: "La entrega queda probada sin revelar receptor, documento ni direccion.",
        resource_type: "secure_delivery_pack",
        resource_id: "SDL-AR-2026-0007",
        payload: {
          batch_code: "SDL-AR-2026-0007",
          delivery_result: "accepted",
          seal_state: "intact",
          claim_window: "available",
          proof_version: 1,
        },
      },
    ],
    receipt: {
      business_claim: "Demuestra que un paquete sellado tuvo custodia y entrega verificable sin publicar receptor ni manifiesto.",
      manager_explanation: "Para operaciones: el cliente ve una prueba externa de integridad; la empresa conserva la ruta completa, permisos y documentos en nexID.",
    },
    proof_layers: [
      { layer: "nexID", purpose: "Fuente privada de eventos, permisos y manifest", status: "activo" },
      { layer: "IOTA", purpose: "Merkle root para auditoria hash-only", status: "testnet-ready" },
      { layer: "Polygon", purpose: "Certificado de ownership o warranty separado", status: "opcional" },
    ],
  },
  {
    id: "pharma-cold-chain",
    title: "Pharma Cold Chain",
    vertical: "Pharma regulado",
    headline: "Lote sensible con evidencia digital verificable de temperatura reportada, revision de tamper y liberacion QA declarada.",
    body: "Ejemplo pensado para una empresa pharma enterprise: la auditoria confirma existencia e integridad del evento sin publicar datos de pacientes, rutas privadas ni documentos de calidad.",
    anchor_id: "22222222-2222-4222-8222-222222222222",
    resource_type: "pharma_batch",
    resource_id: "PHR-LOT-2026-0142",
    anchored_at: "2026-07-02T12:05:00.000Z",
    events: [
      {
        id: "batch-release",
        title: "Lote liberado",
        event_type: "qa_batch_release",
        summary: "QA aprueba el lote y calcula evidencia minima del evento canonico.",
        resource_type: "pharma_batch",
        resource_id: "PHR-LOT-2026-0142",
        payload: {
          batch_code: "PHR-LOT-2026-0142",
          qa_result: "released",
          temperature_band_c: "2-8",
          serialization_level: "case_and_unit",
          proof_version: 1,
        },
      },
      {
        id: "cold-chain-checkpoint",
        title: "Checkpoint frio",
        event_type: "cold_chain_checkpoint",
        summary: "Un sensor u operador reporta una medicion dentro del rango declarado en este checkpoint; no prueba continuidad fuera de esa observacion.",
        resource_type: "pharma_batch",
        resource_id: "PHR-LOT-2026-0142",
        payload: {
          batch_code: "PHR-LOT-2026-0142",
          checkpoint: "regional_hub",
          temperature_band_c: "2-8",
          excursion_detected: false,
          proof_version: 1,
        },
      },
      {
        id: "tamper-review",
        title: "Tamper revisado",
        event_type: "tamper_review",
        summary: "Un operador reporta y revisa el estado de sello declarado para auditoria o reclamo; el evento no certifica integridad fisica por si solo.",
        resource_type: "pharma_batch",
        resource_id: "PHR-LOT-2026-0142",
        payload: {
          batch_code: "PHR-LOT-2026-0142",
          seal_state: "intact",
          recall_flag: false,
          dpp_export: "ready",
          proof_version: 1,
        },
      },
    ],
    receipt: {
      business_claim: "Evidencia que se registraron una liberacion QA, un checkpoint termico reportado y una revision de tamper en el mismo root; no prueba cadena de frio continua ni sello fisico.",
      manager_explanation: "Para calidad/regulatorio: la prueba sirve para auditoria, DPP y reclamos sin publicar pacientes, certificados internos ni rutas privadas.",
    },
    proof_layers: [
      { layer: "nexID", purpose: "QA, permisos, evidencia offline y dashboard privado", status: "activo" },
      { layer: "IOTA", purpose: "Anchor externo de integridad para auditor o inversor", status: "testnet-ready" },
      { layer: "Polygon", purpose: "Ownership transferible solo si el caso comercial lo necesita", status: "opcional" },
    ],
  },
  {
    id: "agro-stewardship",
    title: "Agro Stewardship",
    vertical: "Agro quimico",
    headline: "Insumo agricola con origen, canal autorizado y uso responsable verificable.",
    body: "Ejemplo para agro enterprise: lote, canal, stewardship y reclamo se entienden sin nombrar clientes ni publicar datos operativos sensibles.",
    anchor_id: "33333333-3333-4333-8333-333333333333",
    resource_type: "agro_input_batch",
    resource_id: "AGR-STW-2026-0031",
    anchored_at: "2026-07-02T12:10:00.000Z",
    events: [
      {
        id: "origin-attested",
        title: "Origen atestado",
        event_type: "origin_attested",
        summary: "El lote se emite con canal y politica de uso responsable.",
        resource_type: "agro_input_batch",
        resource_id: "AGR-STW-2026-0031",
        payload: {
          batch_code: "AGR-STW-2026-0031",
          channel_policy: "authorized_distribution",
          stewardship_program: "field_safe_use",
          proof_version: 1,
        },
      },
      {
        id: "field-scan",
        title: "Escaneo de campo",
        event_type: "field_scan",
        summary: "El verificador offline valida producto en zona de baja conectividad.",
        resource_type: "agro_input_batch",
        resource_id: "AGR-STW-2026-0031",
        payload: {
          batch_code: "AGR-STW-2026-0031",
          verification_mode: "offline_then_sync",
          risk_score_band: "low",
          proof_version: 1,
        },
      },
      {
        id: "claim-policy",
        title: "Reclamo habilitado",
        event_type: "claim_policy_opened",
        summary: "Si hay tamper o canal invalido, queda abierto el camino de reclamo.",
        resource_type: "agro_input_batch",
        resource_id: "AGR-STW-2026-0031",
        payload: {
          batch_code: "AGR-STW-2026-0031",
          claim_path: "channel_and_tamper_review",
          counterfeit_signal: false,
          proof_version: 1,
        },
      },
    ],
    receipt: {
      business_claim: "Demuestra origen, canal autorizado, escaneo de campo y politica de reclamo para un insumo agricola.",
      manager_explanation: "Para canal y compliance: prueba stewardship y trazabilidad de uso responsable sin exponer clientes, lotes comerciales reales ni ubicaciones sensibles.",
    },
    proof_layers: [
      { layer: "nexID", purpose: "Identidad de producto, reglas de canal y reclamo", status: "activo" },
      { layer: "IOTA", purpose: "Evidencia publica hash-only para hitos de stewardship", status: "testnet-ready" },
      { layer: "Polygon", purpose: "Certificado NFT de propiedad o garantia cuando aplica", status: "opcional" },
    ],
  },
];

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildDemoCase(seed: DemoSeed): PublicProofDemoCase {
  const events = seed.events.map((event) => ({
    id: event.id,
    title: event.title,
    event_type: event.event_type,
    summary: event.summary,
    hash: hashEvidencePayload({
      tenantId: "public-demo",
      resourceType: event.resource_type,
      resourceId: event.resource_id,
      eventType: event.event_type,
      payload: event.payload,
    }),
  }));
  const merkleRoot = buildMerkleRoot(events.map((event) => event.hash));
  const onChainMemo = [
    "nexID-proof-v1",
    `case=${seed.id}`,
    `vertical=${slug(seed.vertical)}`,
    `resource=${seed.resource_type}:${seed.resource_id}`,
    `events=${events.length}`,
    `root=${merkleRoot}`,
    "privacy=hash-only",
  ].join("|");
  return {
    id: seed.id,
    title: seed.title,
    vertical: seed.vertical,
    headline: seed.headline,
    body: seed.body,
    primary_event_hash: events[0]?.hash || "",
    anchor_id: seed.anchor_id,
    provider: "iota",
    network: "iota-evm-testnet-ready",
    status: "demo_ready",
    merkle_root: merkleRoot,
    resource_type: seed.resource_type,
    resource_id: seed.resource_id,
    anchored_at: seed.anchored_at,
    explorer_url: null,
    tx_hash: null,
    public_receipt: {
      title: `${seed.title} public proof receipt`,
      business_claim: seed.receipt.business_claim,
      manager_explanation: seed.receipt.manager_explanation,
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
    events,
    proof_layers: seed.proof_layers,
  };
}

export const PUBLIC_PROOF_DEMO_CASES = DEMO_SEEDS.map(buildDemoCase);

export function findPublicProofDemoCaseByHash(eventHash: string) {
  const normalized = eventHash.trim().toLowerCase();
  return PUBLIC_PROOF_DEMO_CASES.find((demoCase) =>
    demoCase.events.some((event) => event.hash.toLowerCase() === normalized),
  ) || null;
}

export function findPublicProofDemoCaseById(id: string) {
  const normalized = id.trim().toLowerCase();
  return PUBLIC_PROOF_DEMO_CASES.find((demoCase) => demoCase.id === normalized) || null;
}

export function findPublicProofDemoCaseByAnchorId(anchorId: string) {
  const normalized = anchorId.trim().toLowerCase();
  return PUBLIC_PROOF_DEMO_CASES.find((demoCase) => demoCase.anchor_id.toLowerCase() === normalized) || null;
}

export function findPublicProofDemoCaseByMerkleRoot(merkleRoot: string) {
  const normalized = merkleRoot.trim().toLowerCase();
  return PUBLIC_PROOF_DEMO_CASES.find((demoCase) => demoCase.merkle_root.toLowerCase() === normalized) || null;
}
