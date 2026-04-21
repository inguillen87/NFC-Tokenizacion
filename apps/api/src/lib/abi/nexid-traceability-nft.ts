/**
 * ABI mínima para interacción backend (mint + traceability update).
 * Generada manualmente desde NexidTraceabilityNFT.sol.
 * Cuando tengas artefactos Hardhat, podés reemplazar este archivo por el ABI compilado.
 */
export const NEXID_TRACEABILITY_NFT_ABI = [
  "function mintWithChipHash(address to, string chipUidHash, string tokenUri, string assetRef) external returns (uint256)",
  "function updateTraceability(uint256 tokenId, string traceabilityUri) external",
] as const;
