terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

variable "project_id" { type = string }
variable "location" {
  type    = string
  default = "us-east1"
}

provider "google" { project = var.project_id }

resource "google_project_service" "cloudkms" {
  project            = var.project_id
  service            = "cloudkms.googleapis.com"
  disable_on_destroy = false
}

resource "google_kms_key_ring" "nexid_staging" {
  name       = "nexid-staging"
  location   = var.location
  depends_on = [google_project_service.cloudkms]
}

# Pilot design: three independent AES-256-GCM envelope keys. Existing physical
# tag keys remain unchanged. Polygon/IOTA wallet plaintext is never stored in
# Vercel or Cloud Run configuration; only its KMS ciphertext is stored there.
resource "google_kms_crypto_key" "nfc_wrap" {
  name     = "nfc-wrap-pilot"
  key_ring = google_kms_key_ring.nexid_staging.id
  purpose  = "ENCRYPT_DECRYPT"
  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }
  lifecycle { prevent_destroy = true }
}

resource "google_kms_crypto_key" "polygon_wallet_wrap" {
  name     = "polygon-wallet-wrap-pilot"
  key_ring = google_kms_key_ring.nexid_staging.id
  purpose  = "ENCRYPT_DECRYPT"
  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }
  lifecycle { prevent_destroy = true }
}

resource "google_kms_crypto_key" "iota_wallet_wrap" {
  name     = "iota-wallet-wrap-pilot"
  key_ring = google_kms_key_ring.nexid_staging.id
  purpose  = "ENCRYPT_DECRYPT"
  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }
  lifecycle { prevent_destroy = true }
}

resource "google_service_account" "nfc_runtime" {
  project      = var.project_id
  account_id   = "nexid-nfc-runtime-stg"
  display_name = "Nexid NFC Runtime Staging"
}

resource "google_service_account" "chain_executor" {
  project      = var.project_id
  account_id   = "nexid-chain-executor-stg"
  display_name = "Nexid Polygon Executor Staging"
}

resource "google_service_account" "iota_executor" {
  project      = var.project_id
  account_id   = "nexid-iota-executor-stg"
  display_name = "Nexid IOTA Executor Staging"
}

resource "google_kms_crypto_key_iam_member" "nfc_runtime" {
  crypto_key_id = google_kms_crypto_key.nfc_wrap.id
  role          = "roles/cloudkms.cryptoKeyDecrypter"
  member        = "serviceAccount:${google_service_account.nfc_runtime.email}"
}

resource "google_kms_crypto_key_iam_member" "polygon_executor" {
  crypto_key_id = google_kms_crypto_key.polygon_wallet_wrap.id
  role          = "roles/cloudkms.cryptoKeyDecrypter"
  member        = "serviceAccount:${google_service_account.chain_executor.email}"
}

resource "google_kms_crypto_key_iam_member" "iota_executor" {
  crypto_key_id = google_kms_crypto_key.iota_wallet_wrap.id
  role          = "roles/cloudkms.cryptoKeyDecrypter"
  member        = "serviceAccount:${google_service_account.iota_executor.email}"
}

output "nfc_wrap_key_resource" { value = google_kms_crypto_key.nfc_wrap.id }
output "polygon_wrap_key_resource" { value = google_kms_crypto_key.polygon_wallet_wrap.id }
output "iota_wrap_key_resource" { value = google_kms_crypto_key.iota_wallet_wrap.id }
output "nfc_runtime_service_account" { value = google_service_account.nfc_runtime.email }
output "chain_executor_service_account" { value = google_service_account.chain_executor.email }
output "iota_executor_service_account" { value = google_service_account.iota_executor.email }
