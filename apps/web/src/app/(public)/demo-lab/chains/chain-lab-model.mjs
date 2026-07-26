// @ts-check

const STATUS = Object.freeze({
  verified: {
    code: "verified",
    label: "Verificado por RPC",
    shortLabel: "Verificado",
    explanation: "La evidencia critica fue consultada y coincide con la red testnet.",
  },
  partial: {
    code: "partial",
    label: "Evidencia parcial",
    shortLabel: "Parcial",
    explanation: "Hay evidencia real, pero falta al menos una comprobacion critica.",
  },
  configured: {
    code: "configured",
    label: "Configurado, sin confirmar",
    shortLabel: "Configurado",
    explanation: "La integracion existe, pero esta lectura no confirma una prueba completa en red.",
  },
  unavailable: {
    code: "unavailable",
    label: "No disponible ahora",
    shortLabel: "No disponible",
    explanation: "No hay evidencia suficiente para emitir un veredicto. No se simula un resultado.",
  },
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeHttpUrl(value) {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function short(value, left = 12, right = 10) {
  const candidate = text(value);
  if (!candidate) return "No disponible";
  if (candidate.length <= left + right + 3) return candidate;
  return `${candidate.slice(0, left)}...${candidate.slice(-right)}`;
}

function status(code) {
  return { ...STATUS[code] };
}

function check(id, label, state, detail) {
  return { id, label, state, detail };
}

function evidence(id, label, value, href = null) {
  const raw = text(value);
  return raw ? { id, label, value: raw, displayValue: short(raw), href: safeHttpUrl(href) } : null;
}

function sourceState(value) {
  const source = record(value);
  return {
    ok: source.ok === true,
    status: Number.isInteger(source.status) ? source.status : 0,
    error: text(source.error) || null,
  };
}

function networkIdentity(value) {
  const normalized = text(value).toLowerCase().replace(/[_\s]+/g, "-");
  if (normalized.includes("amoy")) return "polygon-amoy";
  return normalized;
}

function buildIota(catalogValue, sourceOk = true) {
  const catalog = record(catalogValue);
  const testnet = record(catalog.testnet);
  const iota = record(testnet.iota);
  const cases = list(catalog.cases).map(record);
  const anchorSignals = cases.filter((item) => record(record(item.network_verification).anchor).verified === true).length;
  const receiptSignals = cases.filter((item) => record(record(item.network_verification).receipt).verified === true).length;
  const verifiedAnchors = cases.filter((item) => (
    record(record(item.network_verification).anchor).verified === true
    && Boolean(text(item.tx_hash))
    && Boolean(safeHttpUrl(item.explorer_url))
  )).length;
  const verifiedReceipts = cases.filter((item) => {
    const publicReceipt = record(item.public_receipt);
    return record(record(item.network_verification).receipt).verified === true
      && Boolean(text(publicReceipt.tx_hash))
      && Boolean(safeHttpUrl(publicReceipt.explorer_url));
  }).length;
  const contractAddress = text(iota.contract_address);
  const criticalEvidenceComplete = sourceOk
    && iota.rpc_verified === true
    && cases.length > 0
    && verifiedAnchors === cases.length
    && verifiedReceipts === cases.length
    && Boolean(contractAddress);
  const hasVerifiedEvidence = anchorSignals > 0 || receiptSignals > 0 || iota.rpc_verified === true;
  const isConfigured = iota.rpc_configured === true || iota.contract_configured === true || Boolean(contractAddress);
  const state = criticalEvidenceComplete
    ? "verified"
    : hasVerifiedEvidence
      ? "partial"
      : isConfigured
        ? "configured"
        : "unavailable";

  const samples = cases.map((item, index) => {
    const networkVerification = record(item.network_verification);
    const anchor = record(networkVerification.anchor);
    const receipt = record(networkVerification.receipt);
    const publicReceipt = record(item.public_receipt);
    const anchorVerified = anchor.verified === true
      && Boolean(text(item.tx_hash))
      && Boolean(safeHttpUrl(item.explorer_url));
    const receiptVerified = receipt.verified === true
      && Boolean(text(publicReceipt.tx_hash))
      && Boolean(safeHttpUrl(publicReceipt.explorer_url));
    return {
      id: text(item.id) || `iota-case-${index + 1}`,
      title: text(item.title) || "Caso publico IOTA",
      claim: text(publicReceipt.business_claim) || text(item.headline) || "Evidencia hash-only de un evento de trazabilidad.",
      state: anchorVerified && receiptVerified ? "verified" : anchorVerified || receiptVerified ? "partial" : "unavailable",
      stateLabel: anchorVerified && receiptVerified ? "Anchor + recibo confirmados" : anchorVerified ? "Solo anchor confirmado" : receiptVerified ? "Solo recibo confirmado" : "Sin confirmacion RPC",
      anchorHash: text(item.tx_hash) || null,
      anchorExplorerUrl: safeHttpUrl(item.explorer_url),
      receiptHash: text(publicReceipt.tx_hash) || null,
      receiptExplorerUrl: safeHttpUrl(publicReceipt.explorer_url),
      merkleRoot: text(item.merkle_root) || null,
      eventHash: text(item.primary_event_hash) || null,
    };
  });

  return {
    id: "iota",
    name: "IOTA",
    role: "Integridad de eventos y auditoria hash-only",
    network: text(iota.network) || "IOTA EVM testnet",
    environment: "TESTNET",
    status: status(state),
    headline: criticalEvidenceComplete
      ? `${verifiedAnchors} anchors y ${verifiedReceipts} recibos coinciden con IOTA testnet.`
      : state === "partial"
        ? "IOTA devolvio evidencia, pero el circuito de prueba no esta completo."
        : state === "configured"
          ? "IOTA esta configurado, pero esta lectura no confirma transacciones publicas."
          : "No pudimos obtener evidencia IOTA verificable ahora.",
    summary: "nexID agrupa eventos privados, publica hashes o Merkle roots cuando la politica lo exige y permite que un tercero verifique integridad sin ver el dato fuente.",
    plainLanguage: "IOTA responde: ¿esta evidencia existia y sigue siendo la misma? No responde quien es el dueño del producto.",
    checks: [
      check("iota-rpc", "Lectura independiente por RPC", iota.rpc_verified === true ? "pass" : isConfigured ? "warn" : "unavailable", iota.rpc_verified === true ? "El backend consulto la red y valido las publicaciones." : "La red no confirmo el conjunto completo en esta lectura."),
      check("iota-anchors", "Anchors de Merkle root", cases.length > 0 && verifiedAnchors === cases.length ? "pass" : verifiedAnchors > 0 ? "warn" : "unavailable", `${verifiedAnchors} de ${cases.length} casos confirmados.`),
      check("iota-receipts", "Recibos publicos", cases.length > 0 && verifiedReceipts === cases.length ? "pass" : verifiedReceipts > 0 ? "warn" : "unavailable", `${verifiedReceipts} de ${cases.length} memos confirmados por RPC.`),
      check("iota-contract", "Contrato de evidencia", contractAddress ? "pass" : "unavailable", contractAddress ? `Contrato ${short(contractAddress)} disponible en explorer.` : "No se recibio una direccion publica de contrato."),
    ],
    metrics: [
      { label: "Casos publicados", value: String(cases.length) },
      { label: "Anchors RPC", value: `${verifiedAnchors}/${cases.length}` },
      { label: "Recibos RPC", value: `${verifiedReceipts}/${cases.length}` },
    ],
    evidence: [
      evidence("iota-contract", "Contrato", contractAddress, iota.contract_explorer_url),
      evidence("iota-demo-tx", "Transaccion de referencia", iota.demo_tx_hash, iota.demo_tx_explorer_url),
    ].filter(Boolean),
    samples,
    proofBoundary: {
      proves: [
        "Que el hash o Merkle root publicado coincide con la evidencia consultada.",
        "Que la transaccion y el recibo existen en la red testnet cuando RPC los confirma.",
        "Que se puede auditar integridad sin publicar UIDs, rutas ni documentos privados.",
      ],
      doesNotProve: [
        "La identidad legal de una persona o empresa.",
        "La presencia fisica actual del producto.",
        "Propiedad, pago, autenticidad NFC o cumplimiento regulatorio por si solos.",
      ],
    },
    actions: {
      primary: { href: "/proof/verify?layer=iota#iota-proof", label: "Abrir verificador IOTA" },
      secondary: safeHttpUrl(iota.demo_tx_explorer_url) ? { href: safeHttpUrl(iota.demo_tx_explorer_url), label: "Ver transaccion en explorer", external: true } : null,
    },
  };
}

function buildPolygon(catalogValue, certificateValue, sourcesOk = true) {
  const catalog = record(catalogValue);
  const testnet = record(catalog.testnet);
  const polygon = record(testnet.polygon);
  const certificate = record(certificateValue);
  const certificateOwner = record(certificate.owner);
  const certificateClaim = record(certificate.claim);
  const certificateMint = record(certificate.mint);
  const rpcVerified = polygon.rpc_verified === true;
  // A green verdict requires one coherent proof across both public sources.
  // Combining contract A with certificate B would otherwise manufacture a
  // verified result across unrelated tokens.
  const confirmed = text(polygon.verification_state) === "confirmed";
  const metadataVerified = polygon.metadata_verified === true;
  const mintEventsMatch = polygon.mint_events_match === true;
  const transactionHash = text(polygon.demo_tx_hash);
  const transactionExplorerUrl = safeHttpUrl(polygon.demo_tx_explorer_url);
  const contractAddress = text(polygon.contract_address);
  const ownerAddress = text(polygon.owner_address);
  const metadataUrl = safeHttpUrl(polygon.metadata_url);
  const catalogTokenId = text(polygon.demo_token_id);
  const certificateTokenId = text(certificate.token_id);
  const certificateContract = text(certificate.contract_address);
  const contractsMatch = Boolean(
    certificateContract
    && contractAddress
    && certificateContract.toLowerCase() === contractAddress.toLowerCase(),
  );
  const certificateNetwork = networkIdentity(certificate.network);
  const catalogNetwork = networkIdentity(polygon.network);
  const networksMatch = Boolean(
    certificateNetwork
    && catalogNetwork
    && certificateNetwork === catalogNetwork,
  );
  const certificateMatchesCatalog = Boolean(
    catalogTokenId
    && certificateTokenId
    && catalogTokenId === certificateTokenId
    && transactionHash
    && text(certificateMint.tx_hash) === transactionHash
    && ownerAddress
    && text(certificateOwner.address).toLowerCase() === ownerAddress.toLowerCase()
    && contractsMatch
    && networksMatch
  );
  const detailedChecks = list(certificate.checks).map(record);
  const passedCertificateChecks = certificateMatchesCatalog
    ? detailedChecks.filter((item) => item.ok === true).length
    : 0;
  const certificateVerified = certificateMatchesCatalog
    && text(certificate.verification_state) === "confirmed"
    && certificateMint.events_match === true
    && detailedChecks.length > 0
    && passedCertificateChecks === detailedChecks.length;
  const buyerControlled = polygon.wallet_control_verified === true
    && text(polygon.claim_state) === "buyer_controlled"
    && certificateMatchesCatalog
    && (certificateClaim.events_match === true || text(certificateClaim.state) === "buyer_controlled");
  const criticalEvidenceComplete = sourcesOk
    && rpcVerified
    && confirmed
    && metadataVerified
    && mintEventsMatch
    && Boolean(contractAddress)
    && Boolean(ownerAddress)
    && Boolean(catalogTokenId)
    && Boolean(transactionHash)
    && Boolean(transactionExplorerUrl)
    && Boolean(metadataUrl)
    && certificateVerified;
  const hasVerifiedEvidence = rpcVerified || confirmed || mintEventsMatch || metadataVerified;
  const isConfigured = polygon.rpc_configured === true || polygon.contract_configured === true || Boolean(contractAddress);
  const state = criticalEvidenceComplete
    ? "verified"
    : hasVerifiedEvidence
      ? "partial"
      : isConfigured
        ? "configured"
        : "unavailable";
  return {
    id: "polygon",
    name: "Polygon",
    role: "Ownership, certificado y transferencia",
    network: text(polygon.network) || text(certificate.network) || "Polygon Amoy",
    environment: "TESTNET",
    status: status(state),
    headline: criticalEvidenceComplete
      ? buyerControlled
        ? "El mint y la wallet compradora coinciden con Polygon Amoy."
        : "El mint, owner y metadata coinciden con Polygon Amoy."
      : state === "partial"
        ? "Polygon devolvio evidencia, pero falta cerrar una comprobacion critica."
        : state === "configured"
          ? "Polygon esta configurado, pero esta lectura no confirma el certificado."
          : "No pudimos obtener evidencia Polygon verificable ahora.",
    summary: "Polygon se usa solo cuando el negocio necesita representar propiedad, garantia o transferencia. La identidad y el comprobante permanecen fuera de la cadena.",
    plainLanguage: "Polygon responde: ¿que wallet controla este token y que registro publico lo respalda? No autentica el NFC ni valida un pago por si solo.",
    checks: [
      check("polygon-rpc", "Lectura independiente por RPC", rpcVerified ? "pass" : isConfigured ? "warn" : "unavailable", rpcVerified ? "Contrato, owner y mint fueron consultados en Amoy." : "La red no confirmo el certificado completo en esta lectura."),
      check("polygon-mint", "Mint y eventos del contrato", mintEventsMatch ? "pass" : transactionHash ? "warn" : "unavailable", mintEventsMatch ? "Los eventos emitidos coinciden con el token de referencia." : "No se confirmo la coincidencia de eventos."),
      check("polygon-metadata", "Metadata HTTPS", metadataVerified && metadataUrl ? "pass" : metadataUrl ? "warn" : "unavailable", metadataVerified && metadataUrl ? "Documento e imagen de metadata respondieron correctamente." : "La metadata no quedo verificada con una URL HTTPS publica en esta lectura."),
      check("polygon-custody", "Custodia actual", ownerAddress ? (buyerControlled ? "pass" : "warn") : "unavailable", buyerControlled ? "La wallet demo compradora controla el token y su challenge archivado coincide." : ownerAddress ? `Owner actual ${short(ownerAddress)}; no se afirma control comprador.` : "No se recibio un owner verificable."),
      check("polygon-certificate", "Controles detallados", certificateVerified ? "pass" : detailedChecks.length > 0 ? "warn" : "unavailable", detailedChecks.length > 0 ? certificateMatchesCatalog ? `${passedCertificateChecks} de ${detailedChecks.length} controles del certificado aprobaron; tambien se exige estado y mint confirmados.` : "El certificado detallado no coincide con token, mint y owner del catalogo." : "El endpoint detallado no devolvio controles."),
    ],
    metrics: [
      { label: "Token demo", value: catalogTokenId || "No disponible" },
      { label: "Custodia", value: buyerControlled ? "Wallet compradora" : text(polygon.owner_custody) || "No confirmada" },
      { label: "Metadata", value: metadataVerified ? "Verificada" : "Pendiente" },
    ],
    evidence: [
      evidence("polygon-contract", "Contrato", contractAddress, polygon.contract_explorer_url),
      evidence("polygon-mint-tx", "Transaccion de mint", transactionHash, transactionExplorerUrl),
      evidence("polygon-owner", "Owner actual", ownerAddress, polygon.owner_explorer_url || (certificateMatchesCatalog ? certificateOwner.explorer_url : null)),
      evidence("polygon-metadata", "Metadata", metadataUrl, metadataUrl),
    ].filter(Boolean),
    samples: [],
    proofBoundary: {
      proves: [
        "Que el token existe y los eventos del mint coinciden cuando RPC los confirma.",
        "Que ownerOf devuelve la wallet mostrada y la metadata publica esta accesible.",
        "Control de la wallet demo solo cuando la firma y la transferencia archivadas coinciden.",
      ],
      doesNotProve: [
        "La identidad legal o KYC del titular de la wallet.",
        "El pago, la entrega fisica o el titulo legal sobre el bien.",
        "La autenticidad criptografica del tag NFC por si solo.",
      ],
    },
    actions: {
      primary: { href: "/proof/ownership", label: "Abrir certificado Polygon" },
      secondary: transactionExplorerUrl ? { href: transactionExplorerUrl, label: "Ver mint en explorer", external: true } : null,
    },
  };
}

export function buildChainLabViewModel(inputValue = {}) {
  const input = record(inputValue);
  const sources = record(input.sources);
  const catalogSource = sourceState(sources.catalog);
  const certificateSource = sourceState(sources.certificate);
  const iota = buildIota(input.catalog, catalogSource.ok);
  const polygon = buildPolygon(input.catalog, input.certificate, catalogSource.ok && certificateSource.ok);
  const statusCodes = [iota.status.code, polygon.status.code];
  const overallCode = statusCodes.every((value) => value === "verified")
    ? "verified"
    : statusCodes.some((value) => value === "verified" || value === "partial")
      ? "partial"
      : statusCodes.some((value) => value === "configured")
        ? "configured"
        : "unavailable";
  const sourceWarnings = [];
  if (!catalogSource.ok) sourceWarnings.push(`Catalogo publico: ${catalogSource.status || "sin respuesta"}${catalogSource.error ? ` (${catalogSource.error})` : ""}.`);
  if (!certificateSource.ok) sourceWarnings.push(`Certificado Polygon: ${certificateSource.status || "sin respuesta"}${certificateSource.error ? ` (${certificateSource.error})` : ""}.`);

  return {
    environment: "TESTNET",
    environmentNotice: "Laboratorio con redes de prueba. Solo las transacciones mostradas como verificadas fueron confirmadas en testnet; los estados parcial, configurado o no disponible no constituyen confirmacion ni representan activos, dinero o compromisos de produccion.",
    observedAt: text(input.observedAt) || new Date().toISOString(),
    status: status(overallCode),
    sources: {
      catalog: catalogSource,
      certificate: certificateSource,
      warnings: sourceWarnings,
    },
    privacy: text(record(input.catalog).privacy) || "La vista publica no debe exponer UIDs, claves, identidad de clientes, rutas ni documentos privados.",
    chains: { iota, polygon },
  };
}

export { safeHttpUrl };
