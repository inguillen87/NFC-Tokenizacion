# Google Cloud KMS staging

This Terraform module creates two independent, service-managed (non-exportable)
secp256k1 signing keys. It is staging-only and is intentionally not applied by
CI. Use a dedicated Nexid project with billing enabled; never point it at
`obrasaas-production`.

```powershell
terraform init
terraform plan -var="project_id=YOUR_NEXID_PROJECT" -var="signer_service_account=signer@YOUR_NEXID_PROJECT.iam.gserviceaccount.com"
terraform apply -var="project_id=YOUR_NEXID_PROJECT" -var="signer_service_account=signer@YOUR_NEXID_PROJECT.iam.gserviceaccount.com"
```

The resulting key IDs are supplied to the signer service as
`IOTA_KMS_KEY_ID` and `POLYGON_KMS_KEY_ID`. The signer must call Cloud KMS
asymmetric signing and return only the raw signed transaction to the executor.
