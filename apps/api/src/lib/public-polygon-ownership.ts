import { Contract, JsonRpcProvider, ZeroAddress, getAddress, isAddress, verifyMessage } from "ethers";

const POLYGON_OWNERSHIP_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function chipUidHashByTokenId(uint256 tokenId) view returns (string)",
  "function assetRefByTokenId(uint256 tokenId) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event DigitalTwinMinted(uint256 indexed tokenId, address indexed to, string chipUidHash, string assetRef, string tokenUri)",
] as const;

export const PUBLIC_POLYGON_OWNERSHIP_SLUG = "ownership-v2";
export const PUBLIC_POLYGON_CHAIN_ID = 80002;
export const PUBLIC_POLYGON_CONTRACT = "0x673CAE3D79f825bba9cfb2096184c295A5C9Eb4C";
export const PUBLIC_POLYGON_OWNER = "0x644c5D77a34182Db01257bC4C469B01850bc6B2d";
const POLYGON_CERTIFICATE_CACHE_KEY = "__nexid_public_polygon_certificate_v3__";

function clean(value: unknown) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function apiBaseUrl() {
  return clean(process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || "https://api.nexid.lat").replace(/\/$/, "");
}

function webBaseUrl() {
  return clean(process.env.NEXT_PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.WEB_BASE_URL || "https://nexid.lat").replace(/\/$/, "");
}

function explorerBaseUrl() {
  return clean(process.env.POLYGON_EXPLORER_BASE_URL || "https://amoy.polygonscan.com").replace(/\/$/, "");
}

const PUBLIC_POLYGON_METADATA_SCHEMA_VERSION = "nexid-ownership-certificate-v3";

export function publicPolygonMetadataUrl() {
  return `${apiBaseUrl()}/public/polygon/metadata/${PUBLIC_POLYGON_OWNERSHIP_SLUG}`;
}

export function buildPublicPolygonWalletProofMessage(input: {
  contractAddress: string;
  tokenId: string;
  ownerAddress: string;
}) {
  if (!isAddress(input.contractAddress) || !isAddress(input.ownerAddress) || !/^\d+$/.test(input.tokenId)) {
    throw new Error("invalid_public_polygon_wallet_proof_input");
  }

  return [
    "nexID Polygon Ownership - public wallet-control proof",
    "",
    `Network: Polygon Amoy (eip155:${PUBLIC_POLYGON_CHAIN_ID})`,
    `Contract: ${getAddress(input.contractAddress)}`,
    `Token ID: ${input.tokenId}`,
    `Owner wallet: ${getAddress(input.ownerAddress)}`,
    "Certificate: https://nexid.lat/proof/ownership",
    "Purpose: Prove control of the wallet holding this public testnet token.",
    "Authorization: Informational proof only; it cannot authorize a transfer, login or purchase.",
  ].join("\n");
}

export function buildPublicPolygonMetadata() {
  return {
    name: "nexID Testnet Ownership Certificate - Enterprise Pilot",
    description: "Public Polygon Amoy certificate for a transferable nexID digital twin. The current owner and any buyer-control proof are resolved live from the chain and the public certificate; private customer and NFC data remain off-chain.",
    image: `${webBaseUrl()}/demo/wine-secure/real-malbec-bottle-pexels.jpg`,
    external_url: `${webBaseUrl()}/proof/ownership`,
    background_color: "06101F",
    attributes: [
      { trait_type: "Certificate", value: "Testnet ownership certificate" },
      { trait_type: "Network", value: "Polygon Amoy" },
      { trait_type: "Environment", value: "Testnet" },
      { trait_type: "Physical verification", value: "nexID policy gate" },
      { trait_type: "Privacy", value: "Hash-only public binding" },
      { trait_type: "Custody", value: "Resolved live from ownerOf" },
      { trait_type: "Transferability", value: "ERC-721" },
    ],
    properties: {
      schema_version: PUBLIC_POLYGON_METADATA_SCHEMA_VERSION,
      environment: "testnet",
      chain_id: PUBLIC_POLYGON_CHAIN_ID,
      contract: clean(process.env.POLYGON_CONTRACT_ADDRESS) || PUBLIC_POLYGON_CONTRACT,
      public_claim: "A testnet NXDT token was issued with public HTTPS metadata. Current ownership is determined by ownerOf; buyer control is accepted only when transfer receipt and EIP-191 signer both match that owner.",
      does_not_prove_alone: "The NFT does not authenticate the physical object by itself. nexID must validate the NFC/QR policy gate before an ownership action, while buyer identity and commercial records remain private.",
      public_fields: ["certificate type", "network", "contract", "token owner wallet", "metadata", "mint transaction", "ownership transfer", "wallet-control signature"],
      private_fields: ["raw NFC UID or secret", "buyer identity", "invoice", "warranty documents", "CRM segment"],
    },
  };
}

export function validatePublicPolygonMetadataDocument(value: unknown, expectedContractAddress: string) {
  const document = asRecord(value);
  const properties = asRecord(document.properties);
  const image = clean(document.image);
  const externalUrl = clean(document.external_url);
  const metadataContract = clean(properties.contract);
  const allowedImages = new Set([
    `${webBaseUrl()}/demo/wine-secure/real-malbec-bottle-pexels.jpg`,
    "https://nexid.lat/demo/wine-secure/real-malbec-bottle-pexels.jpg",
  ]);
  const allowedExternalUrls = new Set([
    `${webBaseUrl()}/proof/ownership`,
    "https://nexid.lat/proof/ownership",
  ]);
  const contractMatches = isAddress(metadataContract)
    && isAddress(expectedContractAddress)
    && getAddress(metadataContract) === getAddress(expectedContractAddress);
  const checks = [
    { id: "name", ok: Boolean(clean(document.name)), reason: "metadata_name_missing" },
    { id: "description", ok: Boolean(clean(document.description)), reason: "metadata_description_missing" },
    { id: "image", ok: allowedImages.has(image), reason: "metadata_image_url_mismatch" },
    { id: "external_url", ok: allowedExternalUrls.has(externalUrl), reason: "metadata_external_url_mismatch" },
    { id: "schema_version", ok: clean(properties.schema_version) === PUBLIC_POLYGON_METADATA_SCHEMA_VERSION, reason: "metadata_schema_version_mismatch" },
    { id: "environment", ok: clean(properties.environment) === "testnet", reason: "metadata_environment_mismatch" },
    { id: "chain_id", ok: Number(properties.chain_id) === PUBLIC_POLYGON_CHAIN_ID, reason: "metadata_chain_id_mismatch" },
    { id: "contract", ok: contractMatches, reason: "metadata_contract_mismatch" },
    { id: "public_claim", ok: Boolean(clean(properties.public_claim)), reason: "metadata_public_claim_missing" },
    { id: "proof_boundary", ok: Boolean(clean(properties.does_not_prove_alone)), reason: "metadata_proof_boundary_missing" },
  ];
  const failed = checks.find((check) => !check.ok);

  return {
    ok: !failed,
    reason: failed?.reason || null,
    schema_version: clean(properties.schema_version) || null,
    environment: clean(properties.environment) || null,
    chain_id: Number.isFinite(Number(properties.chain_id)) ? Number(properties.chain_id) : null,
    contract: metadataContract || null,
    checks,
  };
}

export function buildPublicPolygonAssetMetadata(assetId: string) {
  return {
    name: `nexID Digital Twin ${assetId}`,
    description: "Public metadata for a nexID digital twin. The asset identifier is derived from a salted product hash; raw NFC identity, buyer data and commercial records remain private.",
    image: `${webBaseUrl()}/nexid-mark-1024.png`,
    external_url: `${webBaseUrl()}/proof/ownership`,
    background_color: "06101F",
    attributes: [
      { trait_type: "Asset ID", value: assetId },
      { trait_type: "Network", value: "Polygon" },
      { trait_type: "Binding", value: "Salted product hash" },
      { trait_type: "Privacy", value: "No raw NFC UID" },
    ],
    properties: {
      schema_version: "nexid-digital-twin-v1",
      public_asset_id: assetId,
      public_fields: ["asset ID", "network", "contract token data"],
      private_fields: ["raw NFC UID or secret", "buyer identity", "invoice", "tenant policy records"],
    },
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 8_000, timeoutReason = "polygon_rpc_timeout"): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(timeoutReason)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readMetadataDocument(tokenUri: string, expectedTokenUri: string, expectedContractAddress: string) {
  if (tokenUri !== expectedTokenUri) {
    return {
      ok: false,
      status: null,
      content_type: null,
      image_ok: false,
      document: null as Record<string, unknown> | null,
      image: null,
      external_url: null,
      validation: null,
      reason: "metadata_url_mismatch",
    };
  }
  if (!tokenUri.startsWith("https://")) {
    return {
      ok: false,
      status: null,
      content_type: null,
      image_ok: false,
      document: null as Record<string, unknown> | null,
      image: null,
      external_url: null,
      validation: null,
      reason: "metadata_not_https",
    };
  }
  try {
    const response = await withTimeout(fetch(tokenUri, { cache: "no-store" }), 6_000, "metadata_fetch_timeout");
    const contentType = response.headers.get("content-type");
    const rawDocument = response.ok ? await response.json().catch(() => null) : null;
    const document = rawDocument && typeof rawDocument === "object" && !Array.isArray(rawDocument)
      ? rawDocument as Record<string, unknown>
      : null;
    const image = clean(document?.image);
    const externalUrl = clean(document?.external_url);
    const validation = validatePublicPolygonMetadataDocument(document, expectedContractAddress);
    const imageMatches = validation.checks.find((check) => check.id === "image")?.ok === true;
    const imageResponse = imageMatches
      ? await withTimeout(fetch(image, { method: "HEAD", cache: "no-store" }), 6_000, "metadata_image_timeout").catch(() => null)
      : null;
    const jsonContentType = Boolean(contentType?.toLowerCase().includes("json"));
    const imageOk = Boolean(imageMatches && imageResponse?.ok);
    const reason = !response.ok
      ? `metadata_http_${response.status}`
      : !jsonContentType
        ? "metadata_content_type_not_json"
        : !document
          ? "metadata_document_invalid"
          : !validation.ok
            ? validation.reason
            : !imageOk
              ? "metadata_image_unreachable"
              : null;
    return {
      ok: Boolean(response.ok && document && jsonContentType && validation.ok),
      status: response.status,
      content_type: contentType,
      image_ok: imageOk,
      document,
      image,
      external_url: externalUrl,
      validation,
      reason,
    };
  } catch {
    return {
      ok: false,
      status: null,
      content_type: null,
      image_ok: false,
      document: null as Record<string, unknown> | null,
      image: null,
      external_url: null,
      validation: null,
      reason: "metadata_fetch_failed",
    };
  }
}

function isVerifiedSourcifyMatch(value: unknown) {
  return ["match", "exact_match"].includes(clean(value).toLowerCase());
}

async function readSourcifyVerification(contractAddress: string) {
  const apiUrl = `https://sourcify.dev/server/v2/contract/${PUBLIC_POLYGON_CHAIN_ID}/${contractAddress}`;
  const publicUrl = `https://repo.sourcify.dev/${PUBLIC_POLYGON_CHAIN_ID}/${contractAddress}`;

  try {
    const response = await withTimeout(fetch(apiUrl, {
      cache: "no-store",
      headers: { accept: "application/json" },
    }), 6_000, "sourcify_fetch_timeout");
    const payload = asRecord(await response.json().catch(() => null));
    const addressMatches = clean(payload.address).toLowerCase() === contractAddress.toLowerCase();
    const chainMatches = Number(payload.chainId) === PUBLIC_POLYGON_CHAIN_ID;
    const creationMatches = isVerifiedSourcifyMatch(payload.creationMatch);
    const runtimeMatches = isVerifiedSourcifyMatch(payload.runtimeMatch);
    const overallMatches = isVerifiedSourcifyMatch(payload.match);
    const ok = response.ok && addressMatches && chainMatches && creationMatches && runtimeMatches && overallMatches;

    return {
      ok,
      checked: true,
      api_url: apiUrl,
      public_url: publicUrl,
      verified_at: clean(payload.verifiedAt) || null,
      match: clean(payload.match) || null,
      creation_match: clean(payload.creationMatch) || null,
      runtime_match: clean(payload.runtimeMatch) || null,
      reason: ok ? null : response.ok ? "sourcify_contract_mismatch" : `sourcify_http_${response.status}`,
    };
  } catch {
    return {
      ok: false,
      checked: false,
      api_url: apiUrl,
      public_url: publicUrl,
      verified_at: null,
      match: null,
      creation_match: null,
      runtime_match: null,
      reason: "sourcify_fetch_failed",
    };
  }
}

async function readPublicPolygonOwnershipCertificateUncached() {
  const rpcUrl = clean(process.env.POLYGON_RPC_URL || "https://polygon-amoy.drpc.org");
  const contractAddress = clean(process.env.POLYGON_CONTRACT_ADDRESS) || PUBLIC_POLYGON_CONTRACT;
  const tokenId = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID) || "19";
  const mintTxHash = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TX_HASH);
  const buyerAddress = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_BUYER_ADDRESS);
  const walletSignature = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_WALLET_SIGNATURE);
  const claimTxHash = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_CLAIM_TX_HASH);
  const buyerProofConfigured = Boolean(buyerAddress || walletSignature || claimTxHash);
  const expectedMetadataUrl = publicPolygonMetadataUrl();
  const explorer = explorerBaseUrl();

  const base = {
    schema_version: "nexid-public-ownership-v3",
    certificate_id: `NX-POLYGON-AMOY-${tokenId}`,
    environment: "testnet" as const,
    network: "polygon-amoy",
    chain_id: PUBLIC_POLYGON_CHAIN_ID,
    contract_address: contractAddress,
    token_id: tokenId,
    mint_tx_hash: mintTxHash || null,
    claim_tx_hash: claimTxHash || null,
    expected_metadata_url: expectedMetadataUrl,
  };

  if (!isAddress(contractAddress) || !/^\d+$/.test(tokenId)) {
    return {
      ...base,
      ok: false,
      verification_state: "invalid_configuration" as const,
      reason: "invalid_polygon_demo_configuration",
    };
  }

  const provider = new JsonRpcProvider(rpcUrl, PUBLIC_POLYGON_CHAIN_ID, { batchMaxCount: 1 });
  const contract = new Contract(contractAddress, POLYGON_OWNERSHIP_ABI, provider);

  try {
    const [network, code, latestBlock, name, symbol, owner, tokenUri, chipUidHash, assetRef, mintReceipt, claimReceipt, sourceVerification] = await withTimeout(Promise.all([
      provider.getNetwork(),
      provider.getCode(contractAddress),
      provider.getBlockNumber(),
      contract.name(),
      contract.symbol(),
      contract.ownerOf(tokenId),
      contract.tokenURI(tokenId),
      contract.chipUidHashByTokenId(tokenId),
      contract.assetRefByTokenId(tokenId),
      mintTxHash ? provider.getTransactionReceipt(mintTxHash) : Promise.resolve(null),
      claimTxHash ? provider.getTransactionReceipt(claimTxHash) : Promise.resolve(null),
      readSourcifyVerification(contractAddress),
    ]));

    const parseLogs = (logs: readonly { address: string; topics: readonly string[]; data: string }[]) => logs.flatMap((log) => {
      if (log.address.toLowerCase() !== contractAddress.toLowerCase()) return [];
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        return parsed ? [parsed] : [];
      } catch {
        return [];
      }
    });
    const mintLogs = parseLogs(mintReceipt?.logs || []);
    const claimLogs = parseLogs(claimReceipt?.logs || []);
    const mintTransferEvent = mintLogs.find((event) => event.name === "Transfer" && String(event.args.tokenId) === tokenId);
    const mintedEvent = mintLogs.find((event) => event.name === "DigitalTwinMinted" && String(event.args.tokenId) === tokenId);
    const claimTransferEvent = claimLogs.find((event) => event.name === "Transfer" && String(event.args.tokenId) === tokenId);
    const metadata = await readMetadataDocument(String(tokenUri), expectedMetadataUrl, contractAddress);
    const sourceVerified = sourceVerification.ok === true;
    const chainMatches = Number(network.chainId) === PUBLIC_POLYGON_CHAIN_ID;
    const contractDeployed = code !== "0x";
    const ownerResolved = isAddress(String(owner));
    const metadataHttps = String(tokenUri).startsWith("https://");
    const metadataMatches = String(tokenUri) === expectedMetadataUrl;
    const mintConfirmed = Boolean(
      mintReceipt
      && mintReceipt.status === 1
      && mintReceipt.to?.toLowerCase() === contractAddress.toLowerCase()
      && mintReceipt.from.toLowerCase() === PUBLIC_POLYGON_OWNER.toLowerCase(),
    );
    const mintEventsMatch = Boolean(
      mintTransferEvent
      && mintedEvent
      && String(mintTransferEvent.args.from).toLowerCase() === ZeroAddress.toLowerCase()
      && String(mintTransferEvent.args.to).toLowerCase() === String(mintedEvent.args.to).toLowerCase()
      && String(mintedEvent.args.chipUidHash) === String(chipUidHash)
      && String(mintedEvent.args.assetRef) === String(assetRef)
      && String(mintedEvent.args.tokenUri) === String(tokenUri),
    );
    const metadataDocumentMatches = Boolean(
      metadata.ok
      && metadata.image_ok
    );
    const mintConfirmations = mintReceipt ? Math.max(0, latestBlock - mintReceipt.blockNumber + 1) : 0;
    const claimConfirmations = claimReceipt ? Math.max(0, latestBlock - claimReceipt.blockNumber + 1) : 0;
    const platformCustody = String(owner).toLowerCase() === PUBLIC_POLYGON_OWNER.toLowerCase();
    const buyerAddressValid = isAddress(buyerAddress);
    const currentOwnerMatchesBuyer = buyerAddressValid && String(owner).toLowerCase() === buyerAddress.toLowerCase();
    const walletProofMessage = buyerAddressValid
      ? buildPublicPolygonWalletProofMessage({ contractAddress, tokenId, ownerAddress: buyerAddress })
      : null;
    let recoveredAddress: string | null = null;
    if (walletProofMessage && walletSignature) {
      try {
        recoveredAddress = getAddress(verifyMessage(walletProofMessage, walletSignature));
      } catch {
        recoveredAddress = null;
      }
    }
    const walletSignatureMatches = Boolean(
      recoveredAddress
      && currentOwnerMatchesBuyer
      && recoveredAddress.toLowerCase() === String(owner).toLowerCase(),
    );
    const claimConfirmed = Boolean(
      claimReceipt
      && claimReceipt.status === 1
      && claimReceipt.to?.toLowerCase() === contractAddress.toLowerCase()
      && claimReceipt.from.toLowerCase() === PUBLIC_POLYGON_OWNER.toLowerCase(),
    );
    const claimEventsMatch = Boolean(
      claimTransferEvent
      && String(claimTransferEvent.args.from).toLowerCase() === PUBLIC_POLYGON_OWNER.toLowerCase()
      && String(claimTransferEvent.args.to).toLowerCase() === String(owner).toLowerCase()
      && currentOwnerMatchesBuyer,
    );
    const buyerControlVerified = claimConfirmed && claimEventsMatch && walletSignatureMatches;
    const essentialChecksPass = chainMatches
      && contractDeployed
      && ownerResolved
      && metadataHttps
      && metadataMatches
      && metadataDocumentMatches
      && mintConfirmed
      && mintEventsMatch
      && (!buyerProofConfigured || buyerControlVerified);

    return {
      ...base,
      ok: true,
      verification_state: essentialChecksPass ? "confirmed" as const : "partial" as const,
      generated_at: new Date().toISOString(),
      product: {
        name: "Producto premium - ownership pilot",
        category: "Wine & spirits",
        certificate_type: "Testnet ownership certificate",
        asset_ref: String(assetRef),
        physical_binding: "nexID hash-only product binding",
      },
      owner: {
        address: String(owner),
        label: buyerControlVerified
          ? "Buyer-controlled demo wallet"
          : platformCustody
            ? "nexID platform custody wallet"
            : "External current holder",
        custody: buyerControlVerified ? "buyer_wallet" : platformCustody ? "platform_managed" : "external_wallet",
        wallet_control_verified: buyerControlVerified,
        explorer_url: `${explorer}/address/${owner}`,
      },
      token: {
        name: String(name),
        symbol: String(symbol),
        token_uri: String(tokenUri),
        chip_uid_hash: String(chipUidHash),
        asset_ref: String(assetRef),
      },
      mint: {
        tx_hash: mintTxHash || null,
        block_number: mintReceipt?.blockNumber || null,
        confirmations: mintConfirmations,
        status: mintConfirmed ? "confirmed" : mintTxHash ? "not_confirmed" : "not_configured",
        recipient: mintedEvent ? String(mintedEvent.args.to) : null,
        events_match: mintEventsMatch,
      },
      claim: {
        state: buyerControlVerified
          ? "buyer_controlled"
          : buyerProofConfigured
            ? "verification_pending"
            : "platform_custody_pilot",
        tx_hash: claimTxHash || null,
        block_number: claimReceipt?.blockNumber || null,
        confirmations: claimConfirmations,
        status: claimConfirmed ? "confirmed" : claimTxHash ? "not_confirmed" : "not_configured",
        events_match: claimEventsMatch,
        from: claimTransferEvent ? String(claimTransferEvent.args.from) : null,
        to: claimTransferEvent ? String(claimTransferEvent.args.to) : null,
      },
      wallet_control: {
        method: "EIP-191",
        freshness: "archival_static_demo",
        purpose: "Public, informational proof that cannot authorize a transfer, login or purchase.",
        message: walletProofMessage,
        signature: walletSignature || null,
        recovered_address: recoveredAddress,
        verified: walletSignatureMatches,
      },
      metadata: {
        status: metadata.status,
        content_type: metadata.content_type,
        document_ok: metadata.ok,
        image_ok: metadata.image_ok,
        name: clean(metadata.document?.name) || null,
        image: clean(metadata.document?.image) || null,
        external_url: metadata.external_url || null,
        semantic_validation: metadata.validation,
        integrity_model: "validated_https_document_not_content_addressed",
        reason: metadata.reason,
      },
      source_verification: sourceVerification,
      checks: [
        { id: "network", label: "Red Polygon Amoy", ok: chainMatches, detail: chainMatches ? "Chain ID 80002" : `Chain ID ${network.chainId}` },
        { id: "contract", label: "Contrato desplegado", ok: contractDeployed, detail: contractAddress },
        { id: "mint", label: "Mint confirmado", ok: mintConfirmed, detail: mintReceipt ? `Bloque ${mintReceipt.blockNumber}` : "Falta recibo configurado" },
        { id: "mint_events", label: "Eventos del mint coinciden", ok: mintEventsMatch, detail: mintEventsMatch ? "Transfer + DigitalTwinMinted" : "No coinciden token, recipient, hash, assetRef o URI" },
        { id: "owner", label: "Owner resuelto on-chain", ok: ownerResolved, detail: String(owner) },
        ...(buyerProofConfigured ? [
          {
            id: "claim_transfer",
            label: "Transferencia de ownership confirmada",
            ok: claimConfirmed && claimEventsMatch,
            detail: claimConfirmed && claimEventsMatch
              ? `Transfer ${PUBLIC_POLYGON_OWNER} -> ${String(owner)}`
              : "El recibo debe transferir este token desde la custodia piloto a la wallet actual",
          },
          {
            id: "wallet_control",
            label: "Firma archivada de wallet coincide",
            ok: walletSignatureMatches,
            detail: walletSignatureMatches
              ? `Firma EIP-191 archivada recupera ${recoveredAddress}`
              : "La firma publica archivada no recupera la wallet que ownerOf devuelve actualmente",
          },
        ] : []),
        { id: "metadata", label: "Metadata HTTPS coincide", ok: metadataMatches, detail: String(tokenUri) },
        { id: "metadata_document", label: "Metadata semantica y recursos coinciden", ok: metadataDocumentMatches, detail: metadataDocumentMatches ? "Schema, red, contrato, entorno, JSON e imagen verificados" : metadata.reason || "Metadata incompleta" },
        {
          id: "source",
          label: "Source code publicado",
          ok: sourceVerified,
          detail: sourceVerified
            ? `Creation + runtime verificados en Sourcify${sourceVerification.verified_at ? ` · ${sourceVerification.verified_at}` : ""}`
            : sourceVerification.reason || "Pendiente de verificacion publica",
        },
      ],
      links: {
        certificate: `${webBaseUrl()}/proof/ownership`,
        metadata: String(tokenUri),
        contract_explorer: `${explorer}/address/${contractAddress}`,
        token_explorer: `${explorer}/token/${contractAddress}?a=${tokenId}`,
        owner_explorer: `${explorer}/address/${owner}`,
        transaction_explorer: mintTxHash ? `${explorer}/tx/${mintTxHash}` : null,
        claim_transaction_explorer: claimTxHash ? `${explorer}/tx/${claimTxHash}` : null,
        source_verification: sourceVerified ? sourceVerification.public_url : null,
      },
      proof_boundary: {
        proves: [
          "The NXDT contract exists on Polygon Amoy.",
          "The configured token, recipient, hash binding, asset reference and URI were emitted by the configured mint transaction.",
          "The current holder wallet, public metadata document and product hash binding can be read independently.",
          ...(buyerControlVerified ? [
            "The configured ownership transaction transferred this token from the nexID pilot wallet to the current holder.",
            "An EIP-191 signature independently recovers the same wallet returned by ownerOf.",
          ] : []),
        ],
        does_not_prove_alone: [
          "That the physical object is authentic without the prior nexID NFC/QR verification.",
          ...(buyerControlVerified
            ? ["That the demo wallet represents a real customer or legal title outside this explicit testnet pilot."]
            : ["Buyer wallet control or a completed buyer ownership transfer; those require a matching transfer receipt and wallet signature."]),
          "The buyer identity, invoice, warranty eligibility or private CRM record.",
          "That the HTTPS metadata is immutable or content-addressed; its current semantic fields are validated at read time.",
          "Mainnet production readiness; this certificate is explicitly a testnet pilot.",
        ],
      },
      privacy: {
        public: ["contract", "token ID", "owner wallet", "mint transaction", "ownership transfer", "wallet-control signature", "hash-only binding", "metadata"],
        private: ["raw NFC UID and secret", "buyer identity", "invoice", "warranty documents", "CRM segment"],
      },
    };
  } catch {
    return {
      ...base,
      ok: false,
      verification_state: "unavailable" as const,
      reason: "polygon_certificate_unavailable",
      generated_at: new Date().toISOString(),
    };
  } finally {
    provider.destroy();
  }
}

type PublicPolygonCertificate = Awaited<ReturnType<typeof readPublicPolygonOwnershipCertificateUncached>>;
type CachedPolygonCertificate = { expiresAt: number; value: Promise<PublicPolygonCertificate> };

function polygonCertificateCache() {
  const scope = globalThis as typeof globalThis & { [POLYGON_CERTIFICATE_CACHE_KEY]?: CachedPolygonCertificate };
  return scope;
}

export function readPublicPolygonOwnershipCertificate(): Promise<PublicPolygonCertificate> {
  const scope = polygonCertificateCache();
  const cached = scope[POLYGON_CERTIFICATE_CACHE_KEY];
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = readPublicPolygonOwnershipCertificateUncached();
  const entry = { expiresAt: Date.now() + 10_000, value };
  scope[POLYGON_CERTIFICATE_CACHE_KEY] = entry;
  void value.then((certificate) => {
    entry.expiresAt = Date.now() + (certificate.verification_state === "confirmed" ? 5 * 60_000 : 10_000);
  }).catch(() => {
    if (scope[POLYGON_CERTIFICATE_CACHE_KEY] === entry) delete scope[POLYGON_CERTIFICATE_CACHE_KEY];
  });
  return value;
}
