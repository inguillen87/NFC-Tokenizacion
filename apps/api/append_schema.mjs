import fs from 'fs';
import path from 'path';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf-8');

const newModels = `

// --- SECURITY & KEY LIFECYCLE ---

model BatchKey {
  id                            String   @id @default(uuid())
  tenantId                      String
  batchId                       String
  keyRole                       String   // "K_META_BATCH" | "K_FILE_BATCH"
  encryptedKeyCt                String
  keyFingerprintSha256Prefix    String
  keyVersion                    Int      @default(1)
  status                        String   // "active" | "rotated" | "revoked"
  createdBy                     String
  createdAt                     DateTime @default(now())
  exportedAt                    DateTime?
  exportedBy                    String?
  tenant                        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  batch                         Batch    @relation(fields: [batchId], references: [id], onDelete: Cascade)
}

// --- SUPPLIER ORDERS ---

model SupplierOrder {
  id                  String   @id @default(uuid())
  tenantId            String
  customerSlug        String
  orderCode           String   @unique
  orderName           String
  totalQuantity       Int
  subBatchSize        Int
  chipModel           String
  carrierProfileCode  String
  materialType        String
  supplierName        String
  status              String
  notes               String?
  createdBy           String
  createdAt           DateTime @default(now())
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  subBatches          SupplierSubBatch[]
  vaultArtifacts      VaultArtifact[]
}

model SupplierSubBatch {
  id                  String   @id @default(uuid())
  supplierOrderId     String
  tenantId            String
  batchId             String   @unique
  quantity            Int
  sequence            String
  chipModel           String
  carrierProfileCode  String
  materialType        String
  metaKeyId           String?
  fileKeyId           String?
  sdmConfig           Json?
  status              String
  manifestCount       Int      @default(0)
  activeCount         Int      @default(0)
  qaStatus            String   @default("pending") // "pending" | "passed" | "failed" | "waived"
  supplierOrder       SupplierOrder @relation(fields: [supplierOrderId], references: [id], onDelete: Cascade)
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

// --- TENANT VAULT ---

model VaultArtifact {
  id                  String   @id @default(uuid())
  tenantId            String
  supplierOrderId     String?
  subBatchId          String?
  artifactType        String
  storagePath         String
  sha256              String
  encrypted           Boolean  @default(false)
  createdBy           String
  createdAt           DateTime @default(now())
  expiresAt           DateTime?
  downloadCount       Int      @default(0)
  lastDownloadedAt    DateTime?
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  supplierOrder       SupplierOrder? @relation(fields: [supplierOrderId], references: [id], onDelete: Cascade)
}

// --- OFFLINE SCAN EVENTS ---

model OfflineScanEvent {
  id                  String   @id @default(uuid())
  localId             String
  operatorId          String
  tenantId            String
  capturedUrl         String
  capturedAt          DateTime
  approximateLocation Json?
  deviceId            String
  status              String   // "PENDING_BACKEND_VERIFICATION" | "SYNCED_VALID" | "SYNCED_INVALID" | "SYNC_FAILED"
  createdAt           DateTime @default(now())
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model OfflinePublicCertificate {
  id                  String   @id @default(uuid())
  productId           String
  batchId             String
  gtin                String?
  lot                 String?
  serial              String?
  issuedAt            DateTime @default(now())
  expiresAt           DateTime?
  payloadHash         String
  signature           String
}

// --- PROOF LAYER ---

model LedgerProvider {
  id                  String   @id @default(uuid())
  code                String   @unique // "none" | "polygon" | "iota"
  name                String
  network             String
  chainId             Int?
  rpcUrlEnvName       String?
  explorerBaseUrl     String?
  enabled             Boolean  @default(false)
  purpose             String   // "ownership" | "proof" | "both"
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model ProofEvent {
  id                  String   @id @default(uuid())
  tenantId            String
  eventType           String
  resourceType        String
  resourceId          String
  batchId             String?
  tagId               String?
  productId           String?
  payloadJson         Json
  payloadHash         String
  hashAlgorithm       String   @default("sha256")
  providerPreference  String   // "none" | "polygon" | "iota"
  status              String   // "pending" | "ready" | "anchored" | "failed" | "disabled"
  createdAt           DateTime @default(now())
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model EvidenceAnchor {
  id                  String   @id @default(uuid())
  tenantId            String
  provider            String   // "polygon" | "iota"
  network             String
  anchorType          String   // "single" | "merkle_batch"
  resourceType        String?
  resourceId          String?
  eventCount          Int
  eventHashes         String[] // String array supported in PG
  merkleRoot          String
  txHash              String?
  explorerUrl         String?
  status              String   // "pending" | "submitted" | "confirmed" | "failed" | "disabled"
  anchoredAt          DateTime?
  errorMessage        String?
  createdBy           String?
  createdAt           DateTime @default(now())
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model OwnershipRecord {
  id                  String   @id @default(uuid())
  tenantId            String
  productId           String?
  tagId               String?
  batchId             String?
  ownerUserId         String?
  walletAddress       String?
  provider            String   @default("polygon")
  network             String
  tokenContract       String?
  tokenId             String?
  txHash              String?
  status              String   // "pending" | "minted" | "claimed" | "transferred" | "failed"
  createdAt           DateTime @default(now())
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

`;

if (!schema.includes('model BatchKey')) {
  fs.writeFileSync(schemaPath, schema + newModels);
  console.log('Appended models to schema.prisma');
} else {
  console.log('Models already exist in schema.prisma');
}

// Update existing models with required back-relations
let updatedSchema = fs.readFileSync(schemaPath, 'utf-8');

function addRelation(modelName, relationLine) {
  const regexStr = 'model \\\\s*' + modelName + '\\\\s*\\\\{[^}]*\\\\}';
  const regex = new RegExp(regexStr);
  const match = updatedSchema.match(regex);
  if (match) {
    if (!match[0].includes(relationLine.trim())) {
      const replaced = match[0].replace(/\\}$/, '  ' + relationLine + '\\n}');
      updatedSchema = updatedSchema.replace(match[0], replaced);
    }
  }
}

addRelation('Tenant', 'batchKeys BatchKey[]');
addRelation('Tenant', 'supplierOrders SupplierOrder[]');
addRelation('Tenant', 'supplierSubBatches SupplierSubBatch[]');
addRelation('Tenant', 'vaultArtifacts VaultArtifact[]');
addRelation('Tenant', 'offlineScanEvents OfflineScanEvent[]');
addRelation('Tenant', 'proofEvents ProofEvent[]');
addRelation('Tenant', 'evidenceAnchors EvidenceAnchor[]');
addRelation('Tenant', 'ownershipRecords OwnershipRecord[]');
addRelation('Batch', 'batchKeys BatchKey[]');

fs.writeFileSync(schemaPath, updatedSchema);
console.log('Updated existing models with relations');
