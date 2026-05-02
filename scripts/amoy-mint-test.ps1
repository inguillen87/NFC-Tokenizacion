param(
  [Parameter(Mandatory = $true)]
  [string]$RpcUrl,

  [Parameter(Mandatory = $true)]
  [string]$Contract,

  [Parameter(Mandatory = $true)]
  [string]$Recipient,

  [string]$PrivateKey,

  [string]$Uid = "04A7DEMO1090",

  [string]$Salt = "nexid-amoy-local-test-salt-only"
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
$mintScript = Join-Path $apiDir "scripts\mint-on-valid-tap.mjs"
$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $bundledNode)) {
  throw "No encontre node bundled en $bundledNode"
}

if ($Contract -notmatch "^0x[a-fA-F0-9]{40}$") {
  throw "Contract invalido. Debe ser 0x + 40 caracteres hex."
}

if ($Recipient -notmatch "^0x[a-fA-F0-9]{40}$") {
  throw "Recipient invalido. Debe ser 0x + 40 caracteres hex."
}

$key = Read-PrivateKey
if ($key -match "^[a-fA-F0-9]{64}$") {
  $key = "0x$key"
}
if ($key -notmatch "^0x[a-fA-F0-9]{64}$") {
  throw "Private key invalida. Debe ser 64 caracteres hex, con o sin prefijo 0x."
}

$publicAssetId = "nx-manual-" + (Get-Date -Format "yyyyMMddHHmmss")
$env:POLYGON_RPC_URL = $RpcUrl
$env:POLYGON_MINTER_PRIVATE_KEY = $key
$env:POLYGON_CONTRACT_ADDRESS = $Contract
$env:POLYGON_DEFAULT_RECIPIENT = $Recipient
$env:TOKENIZATION_UID_SALT = $Salt

Push-Location $apiDir
try {
  & $bundledNode $mintScript `
    "--uid=$Uid" `
    "--uid_salt=$Salt" `
    "--to=$Recipient" `
    "--token_uri=ipfs://nexid-metadata/demo/$publicAssetId.json" `
    "--asset_ref=DEMO-BODEGA-0424:$publicAssetId"
} finally {
  $env:POLYGON_MINTER_PRIVATE_KEY = ""
  Pop-Location
}
