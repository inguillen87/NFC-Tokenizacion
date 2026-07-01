-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'tenant_admin', 'reseller', 'viewer');

-- DropForeignKey
ALTER TABLE "access_requests" DROP CONSTRAINT "access_requests_reviewed_by_fkey";

-- DropForeignKey
ALTER TABLE "alert_rules" DROP CONSTRAINT "alert_rules_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_rotated_from_fkey";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "badges" DROP CONSTRAINT "badges_program_id_fkey";

-- DropForeignKey
ALTER TABLE "badges" DROP CONSTRAINT "badges_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "batches" DROP CONSTRAINT "batches_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_identities" DROP CONSTRAINT "consumer_identities_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_notifications" DROP CONSTRAINT "consumer_notifications_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_notifications" DROP CONSTRAINT "consumer_notifications_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_product_experiences" DROP CONSTRAINT "consumer_product_experiences_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_product_experiences" DROP CONSTRAINT "consumer_product_experiences_event_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_product_experiences" DROP CONSTRAINT "consumer_product_experiences_ownership_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_product_experiences" DROP CONSTRAINT "consumer_product_experiences_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_product_ownerships" DROP CONSTRAINT "consumer_product_ownerships_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_product_ownerships" DROP CONSTRAINT "consumer_product_ownerships_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_product_ownerships" DROP CONSTRAINT "consumer_product_ownerships_event_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_product_ownerships" DROP CONSTRAINT "consumer_product_ownerships_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_product_ownerships" DROP CONSTRAINT "consumer_product_ownerships_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_products" DROP CONSTRAINT "consumer_products_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_products" DROP CONSTRAINT "consumer_products_first_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_products" DROP CONSTRAINT "consumer_products_latest_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_products" DROP CONSTRAINT "consumer_products_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_products" DROP CONSTRAINT "consumer_products_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_reward_claims" DROP CONSTRAINT "consumer_reward_claims_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_reward_claims" DROP CONSTRAINT "consumer_reward_claims_reward_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_reward_claims" DROP CONSTRAINT "consumer_reward_claims_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_reward_claims" DROP CONSTRAINT "consumer_reward_claims_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_reward_wallets" DROP CONSTRAINT "consumer_reward_wallets_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_reward_wallets" DROP CONSTRAINT "consumer_reward_wallets_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_sessions" DROP CONSTRAINT "consumer_sessions_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_tap_history" DROP CONSTRAINT "consumer_tap_history_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_tap_history" DROP CONSTRAINT "consumer_tap_history_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_tap_history" DROP CONSTRAINT "consumer_tap_history_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_tap_history" DROP CONSTRAINT "consumer_tap_history_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_tenant_consents" DROP CONSTRAINT "consumer_tenant_consents_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "consumer_tenant_consents" DROP CONSTRAINT "consumer_tenant_consents_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_members" DROP CONSTRAINT "loyalty_members_event_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_members" DROP CONSTRAINT "loyalty_members_program_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_members" DROP CONSTRAINT "loyalty_members_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_programs" DROP CONSTRAINT "loyalty_programs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_quiz_attempts" DROP CONSTRAINT "loyalty_quiz_attempts_member_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_quiz_attempts" DROP CONSTRAINT "loyalty_quiz_attempts_program_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_quiz_attempts" DROP CONSTRAINT "loyalty_quiz_attempts_quiz_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_quiz_attempts" DROP CONSTRAINT "loyalty_quiz_attempts_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_quiz_attempts" DROP CONSTRAINT "loyalty_quiz_attempts_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_quizzes" DROP CONSTRAINT "loyalty_quizzes_program_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_quizzes" DROP CONSTRAINT "loyalty_quizzes_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_tiers" DROP CONSTRAINT "loyalty_tiers_program_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_tiers" DROP CONSTRAINT "loyalty_tiers_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_brand_profiles" DROP CONSTRAINT "marketplace_brand_profiles_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_offers" DROP CONSTRAINT "marketplace_offers_marketplace_product_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_offers" DROP CONSTRAINT "marketplace_offers_reward_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_offers" DROP CONSTRAINT "marketplace_offers_seller_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_offers" DROP CONSTRAINT "marketplace_offers_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_order_requests" DROP CONSTRAINT "marketplace_order_requests_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_order_requests" DROP CONSTRAINT "marketplace_order_requests_marketplace_product_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_order_requests" DROP CONSTRAINT "marketplace_order_requests_offer_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_order_requests" DROP CONSTRAINT "marketplace_order_requests_source_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_order_requests" DROP CONSTRAINT "marketplace_order_requests_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace_products" DROP CONSTRAINT "marketplace_products_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "member_badges" DROP CONSTRAINT "member_badges_badge_id_fkey";

-- DropForeignKey
ALTER TABLE "member_badges" DROP CONSTRAINT "member_badges_member_id_fkey";

-- DropForeignKey
ALTER TABLE "member_badges" DROP CONSTRAINT "member_badges_program_id_fkey";

-- DropForeignKey
ALTER TABLE "member_badges" DROP CONSTRAINT "member_badges_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "member_badges" DROP CONSTRAINT "member_badges_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_user_id_fkey";

-- DropForeignKey
ALTER TABLE "password_credentials" DROP CONSTRAINT "password_credentials_user_id_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "points_ledger" DROP CONSTRAINT "points_ledger_member_id_fkey";

-- DropForeignKey
ALTER TABLE "points_ledger" DROP CONSTRAINT "points_ledger_program_id_fkey";

-- DropForeignKey
ALTER TABLE "points_ledger" DROP CONSTRAINT "points_ledger_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "points_ledger" DROP CONSTRAINT "points_ledger_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "product_passports" DROP CONSTRAINT "product_passports_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "product_passports" DROP CONSTRAINT "product_passports_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "product_passports" DROP CONSTRAINT "product_passports_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "resource_permissions" DROP CONSTRAINT "resource_permissions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reward_redemptions" DROP CONSTRAINT "reward_redemptions_member_id_fkey";

-- DropForeignKey
ALTER TABLE "reward_redemptions" DROP CONSTRAINT "reward_redemptions_program_id_fkey";

-- DropForeignKey
ALTER TABLE "reward_redemptions" DROP CONSTRAINT "reward_redemptions_reward_id_fkey";

-- DropForeignKey
ALTER TABLE "reward_redemptions" DROP CONSTRAINT "reward_redemptions_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "rewards" DROP CONSTRAINT "rewards_program_id_fkey";

-- DropForeignKey
ALTER TABLE "rewards" DROP CONSTRAINT "rewards_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_claim_requests" DROP CONSTRAINT "sdk_claim_requests_api_key_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_claim_requests" DROP CONSTRAINT "sdk_claim_requests_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_claim_requests" DROP CONSTRAINT "sdk_claim_requests_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_claim_requests" DROP CONSTRAINT "sdk_claim_requests_pos_activation_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_claim_requests" DROP CONSTRAINT "sdk_claim_requests_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_claim_requests" DROP CONSTRAINT "sdk_claim_requests_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_external_events" DROP CONSTRAINT "sdk_external_events_api_key_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_external_events" DROP CONSTRAINT "sdk_external_events_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_external_events" DROP CONSTRAINT "sdk_external_events_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_external_events" DROP CONSTRAINT "sdk_external_events_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_pos_activations" DROP CONSTRAINT "sdk_pos_activations_api_key_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_pos_activations" DROP CONSTRAINT "sdk_pos_activations_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_pos_activations" DROP CONSTRAINT "sdk_pos_activations_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_pos_activations" DROP CONSTRAINT "sdk_pos_activations_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_usage_logs" DROP CONSTRAINT "sdk_usage_logs_api_key_id_fkey";

-- DropForeignKey
ALTER TABLE "sdk_usage_logs" DROP CONSTRAINT "sdk_usage_logs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "security_alerts" DROP CONSTRAINT "security_alerts_event_id_fkey";

-- DropForeignKey
ALTER TABLE "security_alerts" DROP CONSTRAINT "security_alerts_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "security_alerts" DROP CONSTRAINT "security_alerts_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tag_profiles" DROP CONSTRAINT "tag_profiles_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "tag_sun_payloads" DROP CONSTRAINT "tag_sun_payloads_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "tag_sun_payloads" DROP CONSTRAINT "tag_sun_payloads_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "tag_sun_payloads" DROP CONSTRAINT "tag_sun_payloads_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tags" DROP CONSTRAINT "tags_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_api_keys" DROP CONSTRAINT "tenant_api_keys_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_carrier_policies" DROP CONSTRAINT "tenant_carrier_policies_carrier_profile_code_fkey";

-- DropForeignKey
ALTER TABLE "tenant_carrier_policies" DROP CONSTRAINT "tenant_carrier_policies_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_consumer_memberships" DROP CONSTRAINT "tenant_consumer_memberships_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_consumer_memberships" DROP CONSTRAINT "tenant_consumer_memberships_first_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_consumer_memberships" DROP CONSTRAINT "tenant_consumer_memberships_last_tap_event_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_consumer_memberships" DROP CONSTRAINT "tenant_consumer_memberships_loyalty_program_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_consumer_memberships" DROP CONSTRAINT "tenant_consumer_memberships_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_manifests" DROP CONSTRAINT "tenant_manifests_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_manifests" DROP CONSTRAINT "tenant_manifests_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_sun_profiles" DROP CONSTRAINT "tenant_sun_profiles_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "user_invites" DROP CONSTRAINT "user_invites_invited_by_fkey";

-- DropForeignKey
ALTER TABLE "user_invites" DROP CONSTRAINT "user_invites_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "user_mfa_factors" DROP CONSTRAINT "user_mfa_factors_user_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "webhook_deliveries_endpoint_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_endpoints" DROP CONSTRAINT "webhook_endpoints_tenant_id_fkey";

-- DropTable
DROP TABLE "access_requests";

-- DropTable
DROP TABLE "alert_rules";

-- DropTable
DROP TABLE "auth_sessions";

-- DropTable
DROP TABLE "badges";

-- DropTable
DROP TABLE "batches";

-- DropTable
DROP TABLE "carrier_profiles";

-- DropTable
DROP TABLE "consumer_auth_challenges";

-- DropTable
DROP TABLE "consumer_identities";

-- DropTable
DROP TABLE "consumer_notifications";

-- DropTable
DROP TABLE "consumer_product_experiences";

-- DropTable
DROP TABLE "consumer_product_ownerships";

-- DropTable
DROP TABLE "consumer_products";

-- DropTable
DROP TABLE "consumer_reward_claims";

-- DropTable
DROP TABLE "consumer_reward_wallets";

-- DropTable
DROP TABLE "consumer_sessions";

-- DropTable
DROP TABLE "consumer_tap_history";

-- DropTable
DROP TABLE "consumer_tenant_consents";

-- DropTable
DROP TABLE "consumers";

-- DropTable
DROP TABLE "demo_cta_actions";

-- DropTable
DROP TABLE "events";

-- DropTable
DROP TABLE "leads";

-- DropTable
DROP TABLE "loyalty_members";

-- DropTable
DROP TABLE "loyalty_programs";

-- DropTable
DROP TABLE "loyalty_quiz_attempts";

-- DropTable
DROP TABLE "loyalty_quizzes";

-- DropTable
DROP TABLE "loyalty_tiers";

-- DropTable
DROP TABLE "marketplace_brand_profiles";

-- DropTable
DROP TABLE "marketplace_offers";

-- DropTable
DROP TABLE "marketplace_order_requests";

-- DropTable
DROP TABLE "marketplace_products";

-- DropTable
DROP TABLE "member_badges";

-- DropTable
DROP TABLE "memberships";

-- DropTable
DROP TABLE "order_requests";

-- DropTable
DROP TABLE "password_credentials";

-- DropTable
DROP TABLE "password_reset_tokens";

-- DropTable
DROP TABLE "points_ledger";

-- DropTable
DROP TABLE "product_passports";

-- DropTable
DROP TABLE "resource_permissions";

-- DropTable
DROP TABLE "reward_redemptions";

-- DropTable
DROP TABLE "rewards";

-- DropTable
DROP TABLE "schema_migrations";

-- DropTable
DROP TABLE "sdk_claim_requests";

-- DropTable
DROP TABLE "sdk_external_events";

-- DropTable
DROP TABLE "sdk_pos_activations";

-- DropTable
DROP TABLE "sdk_usage_logs";

-- DropTable
DROP TABLE "security_alerts";

-- DropTable
DROP TABLE "sun_diagnostics";

-- DropTable
DROP TABLE "sun_rate_limit_events";

-- DropTable
DROP TABLE "sun_scan_attempts";

-- DropTable
DROP TABLE "tag_manual_tamper_overrides";

-- DropTable
DROP TABLE "tag_profiles";

-- DropTable
DROP TABLE "tag_sun_payloads";

-- DropTable
DROP TABLE "tags";

-- DropTable
DROP TABLE "tenant_api_keys";

-- DropTable
DROP TABLE "tenant_carrier_policies";

-- DropTable
DROP TABLE "tenant_consumer_memberships";

-- DropTable
DROP TABLE "tenant_manifests";

-- DropTable
DROP TABLE "tenant_sun_profiles";

-- DropTable
DROP TABLE "tenants";

-- DropTable
DROP TABLE "tickets";

-- DropTable
DROP TABLE "tokenization_requests";

-- DropTable
DROP TABLE "user_auth_events";

-- DropTable
DROP TABLE "user_invites";

-- DropTable
DROP TABLE "user_mfa_factors";

-- DropTable
DROP TABLE "users";

-- DropTable
DROP TABLE "webhook_deliveries";

-- DropTable
DROP TABLE "webhook_endpoints";

-- DropEnum
DROP TYPE "admin_user_status";

-- DropEnum
DROP TYPE "batch_status";

-- DropEnum
DROP TYPE "consumer_reward_claim_status";

-- DropEnum
DROP TYPE "consumer_status";

-- DropEnum
DROP TYPE "loyalty_member_status";

-- DropEnum
DROP TYPE "loyalty_program_status";

-- DropEnum
DROP TYPE "marketplace_visibility";

-- DropEnum
DROP TYPE "membership_role";

-- DropEnum
DROP TYPE "points_source";

-- DropEnum
DROP TYPE "reward_redemption_status";

-- DropEnum
DROP TYPE "reward_type";

-- DropEnum
DROP TYPE "tag_status";

-- DropEnum
DROP TYPE "tenant_membership_status";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "bid" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "uidHex" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "keyRole" TEXT NOT NULL,
    "encryptedKeyCt" TEXT NOT NULL,
    "keyFingerprintSha256Prefix" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedAt" TIMESTAMP(3),
    "exportedBy" TEXT,

    CONSTRAINT "BatchKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerSlug" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "subBatchSize" INTEGER NOT NULL,
    "chipModel" TEXT NOT NULL,
    "carrierProfileCode" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSubBatch" (
    "id" TEXT NOT NULL,
    "supplierOrderId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sequence" TEXT NOT NULL,
    "chipModel" TEXT NOT NULL,
    "carrierProfileCode" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "metaKeyId" TEXT,
    "fileKeyId" TEXT,
    "sdmConfig" JSONB,
    "status" TEXT NOT NULL,
    "manifestCount" INTEGER NOT NULL DEFAULT 0,
    "activeCount" INTEGER NOT NULL DEFAULT 0,
    "qaStatus" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "SupplierSubBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultArtifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierOrderId" TEXT,
    "subBatchId" TEXT,
    "artifactType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadedAt" TIMESTAMP(3),

    CONSTRAINT "VaultArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineScanEvent" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "capturedUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "approximateLocation" JSONB,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflinePublicCertificate" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "gtin" TEXT,
    "lot" TEXT,
    "serial" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,

    CONSTRAINT "OfflinePublicCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerProvider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "chainId" INTEGER,
    "rpcUrlEnvName" TEXT,
    "explorerBaseUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "batchId" TEXT,
    "tagId" TEXT,
    "productId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL DEFAULT 'sha256',
    "providerPreference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAnchor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "anchorType" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "eventCount" INTEGER NOT NULL,
    "eventHashes" TEXT[],
    "merkleRoot" TEXT NOT NULL,
    "txHash" TEXT,
    "explorerUrl" TEXT,
    "status" TEXT NOT NULL,
    "anchoredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT,
    "tagId" TEXT,
    "batchId" TEXT,
    "ownerUserId" TEXT,
    "walletAddress" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'polygon',
    "network" TEXT NOT NULL,
    "tokenContract" TEXT,
    "tokenId" TEXT,
    "txHash" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnershipRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_bid_key" ON "Batch"("bid");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_locale_slug_key" ON "KnowledgeArticle"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOrder_orderCode_key" ON "SupplierOrder"("orderCode");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSubBatch_batchId_key" ON "SupplierSubBatch"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerProvider_code_key" ON "LedgerProvider"("code");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchKey" ADD CONSTRAINT "BatchKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchKey" ADD CONSTRAINT "BatchKey_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSubBatch" ADD CONSTRAINT "SupplierSubBatch_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSubBatch" ADD CONSTRAINT "SupplierSubBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultArtifact" ADD CONSTRAINT "VaultArtifact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultArtifact" ADD CONSTRAINT "VaultArtifact_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineScanEvent" ADD CONSTRAINT "OfflineScanEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofEvent" ADD CONSTRAINT "ProofEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAnchor" ADD CONSTRAINT "EvidenceAnchor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipRecord" ADD CONSTRAINT "OwnershipRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

