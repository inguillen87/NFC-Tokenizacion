param(
  [string]$Migration = "20260502211500_0028_strict_tenant_manifest_onboarding.sql",
  [string]$DatabaseUrl
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

$dbUrl = Read-DatabaseUrl
if (-not $dbUrl) { throw "DATABASE_URL vacio" }

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
