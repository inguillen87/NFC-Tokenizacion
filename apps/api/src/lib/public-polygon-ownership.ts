import { Contract, JsonRpcProvider, isAddress } from "ethers";

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

function clean(value: unknown) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function bool(value: unknown) {
  return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase());
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

export function publicPolygonMetadataUrl() {
  return `${apiBaseUrl()}/public/polygon/metadata/${PUBLIC_POLYGON_OWNERSHIP_SLUG}`;
}

export function buildPublicPolygonMetadata() {
  return {
    name: "nexID Testnet Issuance Record - Enterprise Pilot",
    description: "Public Polygon Amoy issuance record held in nexID platform custody. It demonstrates a resolvable digital twin, mint transaction and privacy-safe product binding; it is not yet a buyer-controlled ownership claim.",
    image: `${webBaseUrl()}/demo/wine-secure/real-malbec-bottle-pexels.jpg`,
    external_url: `${webBaseUrl()}/proof/ownership`,
    background_color: "06101F",
    attributes: [
      { trait_type: "Certificate", value: "Testnet issuance record" },
      { trait_type: "Network", value: "Polygon Amoy" },
      { trait_type: "Environment", value: "Testnet" },
      { trait_type: "Physical verification", value: "nexID policy gate" },
      { trait_type: "Privacy", value: "Hash-only public binding" },
      { trait_type: "Custody", value: "nexID platform pilot wallet" },
      { trait_type: "Transferability", value: "ERC-721" },
    ],
    properties: {
      schema_version: "nexid-ownership-certificate-v2",
      environment: "testnet",
      chain_id: PUBLIC_POLYGON_CHAIN_ID,
      contract: clean(process.env.POLYGON_CONTRACT_ADDRESS) || PUBLIC_POLYGON_CONTRACT,
      public_claim: "A testnet NXDT token was issued to a platform-managed pilot wallet with public HTTPS metadata.",
      does_not_prove_alone: "This record does not prove buyer wallet control or authenticate the physical object by itself. Buyer ownership requires a signed wallet challenge and an on-chain transfer after the nexID NFC/QR policy gate.",
      public_fields: ["certificate type", "network", "contract", "token owner wallet", "metadata", "mint transaction"],
      private_fields: ["raw NFC UID or secret", "buyer identity", "invoice", "warranty documents", "CRM segment"],
    },
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 8_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("polygon_rpc_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readMetadataDocument(tokenUri: string) {
  if (!tokenUri.startsWith("https://")) {
    return { ok: false, status: null, content_type: null, image_ok: false, document: null as Record<string, unknown> | null, reason: "metadata_not_https" };
  }
  try {
    const response = await withTimeout(fetch(tokenUri, { cache: "no-store" }), 6_000);
    const contentType = response.headers.get("content-type");
    const document = response.ok ? await response.json().catch(() => null) as Record<string, unknown> | null : null;
    const image = clean(document?.image);
    const externalUrl = clean(document?.external_url);
    const imageResponse = image.startsWith("https://")
      ? await withTimeout(fetch(image, { method: "HEAD", cache: "no-store" }), 6_000).catch(() => null)
      : null;
    return {
      ok: Boolean(response.ok && document && contentType?.toLowerCase().includes("json")),
      status: response.status,
      content_type: contentType,
      image_ok: Boolean(imageResponse?.ok),
      document,
      image,
      external_url: externalUrl,
      reason: response.ok ? null : `metadata_http_${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      content_type: null,
      image_ok: false,
      document: null as Record<string, unknown> | null,
      reason: error instanceof Error ? error.message : "metadata_fetch_failed",
    };
  }
}

export async function readPublicPolygonOwnershipCertificate() {
  const rpcUrl = clean(process.env.POLYGON_RPC_URL || "https://polygon-amoy.drpc.org");
  const contractAddress = clean(process.env.POLYGON_CONTRACT_ADDRESS) || PUBLIC_POLYGON_CONTRACT;
  const tokenId = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID) || "19";
  const mintTxHash = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TX_HASH);
  const expectedMetadataUrl = publicPolygonMetadataUrl();
  const explorer = explorerBaseUrl();
  const knownSourcifyContract = contractAddress.toLowerCase() === PUBLIC_POLYGON_CONTRACT.toLowerCase();
  const sourceVerified = knownSourcifyContract || bool(process.env.PUBLIC_PROOF_DEMO_POLYGON_SOURCE_VERIFIED);
  const sourceVerificationUrl = `https://repo.sourcify.dev/${PUBLIC_POLYGON_CHAIN_ID}/${contractAddress}`;

  const base = {
    schema_version: "nexid-public-ownership-v2",
    certificate_id: `NX-POLYGON-AMOY-${tokenId}`,
    environment: "testnet" as const,
    network: "polygon-amoy",
    chain_id: PUBLIC_POLYGON_CHAIN_ID,
    contract_address: contractAddress,
    token_id: tokenId,
    mint_tx_hash: mintTxHash || null,
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
    const [network, code, latestBlock, name, symbol, owner, tokenUri, chipUidHash, assetRef, receipt] = await withTimeout(Promise.all([
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
    ]));

    const parsedLogs = (receipt?.logs || []).flatMap((log) => {
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        return parsed ? [parsed] : [];
      } catch {
        return [];
      }
    });
    const transferEvent = parsedLogs.find((event) => event.name === "Transfer" && String(event.args.tokenId) === tokenId);
    const mintedEvent = parsedLogs.find((event) => event.name === "DigitalTwinMinted" && String(event.args.tokenId) === tokenId);
    const metadata = await readMetadataDocument(String(tokenUri));
    const chainMatches = Number(network.chainId) === PUBLIC_POLYGON_CHAIN_ID;
    const contractDeployed = code !== "0x";
    const ownerResolved = isAddress(String(owner));
    const metadataHttps = String(tokenUri).startsWith("https://");
    const metadataMatches = String(tokenUri) === expectedMetadataUrl;
    const mintConfirmed = Boolean(receipt && receipt.status === 1 && receipt.to?.toLowerCase() === contractAddress.toLowerCase());
    const mintEventsMatch = Boolean(
      transferEvent
      && mintedEvent
      && String(transferEvent.args.to).toLowerCase() === String(mintedEvent.args.to).toLowerCase()
      && String(mintedEvent.args.chipUidHash) === String(chipUidHash)
      && String(mintedEvent.args.assetRef) === String(assetRef)
      && String(mintedEvent.args.tokenUri) === String(tokenUri),
    );
    const metadataDocumentMatches = Boolean(
      metadata.ok
      && metadata.image_ok
      && metadata.external_url === `${webBaseUrl()}/proof/ownership`
      && clean(metadata.document?.name),
    );
    const confirmations = receipt ? Math.max(0, latestBlock - receipt.blockNumber + 1) : 0;
    const essentialChecksPass = chainMatches && contractDeployed && ownerResolved && metadataHttps && metadataMatches && metadataDocumentMatches && mintConfirmed && mintEventsMatch;
    const platformCustody = String(owner).toLowerCase() === PUBLIC_POLYGON_OWNER.toLowerCase();

    return {
      ...base,
      ok: true,
      verification_state: essentialChecksPass ? "confirmed" as const : "partial" as const,
      generated_at: new Date().toISOString(),
      product: {
        name: "Producto premium - issuance pilot",
        category: "Wine & spirits",
        certificate_type: "Testnet issuance record",
        asset_ref: String(assetRef),
        physical_binding: "nexID hash-only product binding",
      },
      owner: {
        address: String(owner),
        label: platformCustody ? "nexID platform custody wallet" : "External current holder",
        custody: platformCustody ? "platform_managed" : "external_wallet",
        wallet_control_verified: false,
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
        block_number: receipt?.blockNumber || null,
        confirmations,
        status: mintConfirmed ? "confirmed" : mintTxHash ? "not_confirmed" : "not_configured",
        recipient: mintedEvent ? String(mintedEvent.args.to) : null,
        events_match: mintEventsMatch,
      },
      metadata: {
        status: metadata.status,
        content_type: metadata.content_type,
        document_ok: metadata.ok,
        image_ok: metadata.image_ok,
        name: clean(metadata.document?.name) || null,
        image: clean(metadata.document?.image) || null,
        external_url: metadata.external_url || null,
        reason: metadata.reason,
      },
      checks: [
        { id: "network", label: "Red Polygon Amoy", ok: chainMatches, detail: chainMatches ? "Chain ID 80002" : `Chain ID ${network.chainId}` },
        { id: "contract", label: "Contrato desplegado", ok: contractDeployed, detail: contractAddress },
        { id: "mint", label: "Mint confirmado", ok: mintConfirmed, detail: receipt ? `Bloque ${receipt.blockNumber}` : "Falta recibo configurado" },
        { id: "mint_events", label: "Eventos del mint coinciden", ok: mintEventsMatch, detail: mintEventsMatch ? "Transfer + DigitalTwinMinted" : "No coinciden token, recipient, hash, assetRef o URI" },
        { id: "owner", label: "Owner resuelto on-chain", ok: ownerResolved, detail: String(owner) },
        { id: "metadata", label: "Metadata HTTPS coincide", ok: metadataMatches, detail: String(tokenUri) },
        { id: "metadata_document", label: "JSON, imagen y enlace resuelven", ok: metadataDocumentMatches, detail: metadataDocumentMatches ? "Documento e imagen HTTP 200" : metadata.reason || "Metadata incompleta" },
        { id: "source", label: "Source code publicado", ok: sourceVerified, detail: sourceVerified ? "Creation + runtime verificados en Sourcify" : "Pendiente de verificacion publica" },
      ],
      links: {
        certificate: `${webBaseUrl()}/proof/ownership`,
        metadata: String(tokenUri),
        contract_explorer: `${explorer}/address/${contractAddress}`,
        token_explorer: `${explorer}/token/${contractAddress}?a=${tokenId}`,
        owner_explorer: `${explorer}/address/${owner}`,
        transaction_explorer: mintTxHash ? `${explorer}/tx/${mintTxHash}` : null,
        source_verification: sourceVerified ? sourceVerificationUrl : null,
      },
      proof_boundary: {
        proves: [
          "The NXDT contract exists on Polygon Amoy.",
          "The configured token, recipient, hash binding, asset reference and URI were emitted by the configured mint transaction.",
          "The current holder wallet, public metadata document and product hash binding can be read independently.",
        ],
        does_not_prove_alone: [
          "That the physical object is authentic without the prior nexID NFC/QR verification.",
          "Buyer wallet control or a completed buyer ownership transfer; the current pilot token remains in platform custody.",
          "The buyer identity, invoice, warranty eligibility or private CRM record.",
          "Mainnet production readiness; this certificate is explicitly a testnet pilot.",
        ],
      },
      privacy: {
        public: ["contract", "token ID", "owner wallet", "mint transaction", "hash-only binding", "metadata"],
        private: ["raw NFC UID and secret", "buyer identity", "invoice", "warranty documents", "CRM segment"],
      },
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      verification_state: "unavailable" as const,
      reason: error instanceof Error ? error.message : "polygon_certificate_unavailable",
      generated_at: new Date().toISOString(),
    };
  } finally {
    provider.destroy();
  }
}
