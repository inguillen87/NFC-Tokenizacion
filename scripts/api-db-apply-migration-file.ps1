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
  "20260723213000_0054_iota_executor_publications.sql"
)
if ($v2Migrations -contains $Migration) {
  if (-not $StagingApproved -and $env:STAGING_MIGRATION_APPROVED -ne "YES") {
    throw "V2 staging migration requires -StagingApproved or STAGING_MIGRATION_APPROVED=YES"
  }
  if ($env:NODE_ENV -eq "production") { throw "Refusing V2 migration against production environment" }
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
