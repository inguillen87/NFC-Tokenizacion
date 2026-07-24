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
variable "signer_service_account" { type = string }

provider "google" { project = var.project_id }

resource "google_kms_key_ring" "nexid_staging" {
  name     = "nexid-staging"
  location = var.location
}

resource "google_kms_crypto_key" "iota" {
  name            = "iota-publisher"
  key_ring        = google_kms_key_ring.nexid_staging.id
  purpose         = "ASYMMETRIC_SIGN"
  rotation_period = "7776000s"
  version_template {
    algorithm        = "EC_SIGN_SECP256K1_SHA256"
    protection_level = "SOFTWARE"
  }
}

resource "google_kms_crypto_key" "polygon" {
  name            = "polygon-publisher"
  key_ring        = google_kms_key_ring.nexid_staging.id
  purpose         = "ASYMMETRIC_SIGN"
  rotation_period = "7776000s"
  version_template {
    algorithm        = "EC_SIGN_SECP256K1_SHA256"
    protection_level = "SOFTWARE"
  }
}

resource "google_kms_crypto_key_iam_member" "iota_signer" {
  crypto_key_id = google_kms_crypto_key.iota.id
  role          = "roles/cloudkms.signerVerifier"
  member        = "serviceAccount:${var.signer_service_account}"
}

resource "google_kms_crypto_key_iam_member" "polygon_signer" {
  crypto_key_id = google_kms_crypto_key.polygon.id
  role          = "roles/cloudkms.signerVerifier"
  member        = "serviceAccount:${var.signer_service_account}"
}

output "iota_key_id" { value = google_kms_crypto_key.iota.id }
output "polygon_key_id" { value = google_kms_crypto_key.polygon.id }
