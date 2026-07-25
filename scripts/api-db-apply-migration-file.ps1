param(
  [string]$Migration = "20260502211500_0028_strict_tenant_manifest_onboarding.sql",
  [string]$DatabaseUrl,
  [switch]$StagingApproved
)

$ErrorActionPreference = "Stop"

function Resolve-Node {
  $bundled = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if (Test-Path $bundled) { return $bundled }

  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  throw "No encontre Node.js. Abri Codex o instala Node.js para aplicar migrations."
}

function Read-DatabaseUrl {
  if ($DatabaseUrl) { return $DatabaseUrl.Trim() }

  $secure = Read-Host "Paste DATABASE_URL de Neon/Postgres (input hidden)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

$v2Migrations = @(
  "20260723193000_0050_evidence_anchor_reconciling_status.sql",
  "20260723193500_0051_iota_evidence_anchor_v2_writer.sql",
  "20260723194500_0052_webhook_delivery_outbox.sql",
  "20260723200500_0053_admin_login_abuse_guard.sql",
  "20260723213000_0054_iota_executor_publications.sql",
  "20260724213000_0055_iota_executor_durable_broadcast.sql",
  "20260725014500_0056_iota_evidence_constraints_validate.sql"
)
if ($v2Migrations -contains $Migration) {
  throw "IOTA V2 migrations must use npm run apply:staging:v2; the legacy file runner is not atomic with its ledger"
}

$dbUrl = Read-DatabaseUrl
if (-not $dbUrl) { throw "DATABASE_URL vacio" }
if ($v2Migrations -contains $Migration -and $dbUrl -match "production|prod[-_.]") { throw "Refusing V2 migration against production-looking database" }

$repo = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $repo "apps\api"
$node = Resolve-Node

Push-Location $apiDir
try {
  $env:DATABASE_URL = $dbUrl
  & $node ".\scripts\db-apply-file.mjs" $Migration
  if ($LASTEXITCODE -ne 0) { throw "Migration fallo con exit code $LASTEXITCODE" }
} finally {
  Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
  Pop-Location
}
