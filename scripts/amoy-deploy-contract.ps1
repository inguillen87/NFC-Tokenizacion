param(
  [Parameter(Mandatory = $true)]
  [string]$RpcUrl,

  [Parameter(Mandatory = $true)]
  [string]$Address,

  [string]$PrivateKey
)

$ErrorActionPreference = "Stop"

function Read-PrivateKey {
  if ($PrivateKey) {
    return $PrivateKey.Trim()
  }

  $secure = Read-Host "Paste POLYGON_MINTER_PRIVATE_KEY for the Amoy pilot wallet (input hidden)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $repoRoot "apps\api"
$hardhatCli = Join-Path $repoRoot "node_modules\hardhat\internal\cli\cli.js"
$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $bundledNode)) {
  throw "No encontre node bundled en $bundledNode"
}

if (-not (Test-Path $hardhatCli)) {
  throw "No encontre Hardhat CLI en $hardhatCli"
}

if ($Address -notmatch "^0x[a-fA-F0-9]{40}$") {
  throw "Address invalida. Debe ser 0x + 40 caracteres hex."
}

$key = Read-PrivateKey
if ($key -match "^[a-fA-F0-9]{64}$") {
  $key = "0x$key"
}
if ($key -notmatch "^0x[a-fA-F0-9]{64}$") {
  throw "Private key invalida. Debe ser 64 caracteres hex, con o sin prefijo 0x. No pegues la address publica; la private key es distinta."
}

$env:POLYGON_RPC_URL = $RpcUrl
$env:POLYGON_MINTER_PRIVATE_KEY = $key
$env:POLYGON_DEPLOY_OWNER = $Address
$env:POLYGON_MINTER_ADDRESS = $Address

Push-Location $apiDir
try {
  Write-Host "Compilando contrato nexID..." -ForegroundColor Cyan
  & $bundledNode $hardhatCli compile

  Write-Host "Deployando NexidTraceabilityNFT en Polygon Amoy..." -ForegroundColor Cyan
  & $bundledNode $hardhatCli run "scripts\deploy-nexid-amoy.mjs" --network amoy
} finally {
  $env:POLYGON_MINTER_PRIVATE_KEY = ""
  Pop-Location
}
