param(
  [ValidateSet("bootstrap","batch","both")]
  [string]$Mode = "both",
  [string]$ClientSlug = "demo-mendoza",
  [string]$BatchId = "DEMO-YYYYMMDD-001",
  [string]$OutDir = ".",
  [string]$KmsFile = ".platform-kms.local.env"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-HexKey([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  ($b | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Get-Hmac16Hex([string]$masterHex, [string]$label) {
  $keyBytes = for ($i = 0; $i -lt $masterHex.Length; $i += 2) { [Convert]::ToByte($masterHex.Substring($i, 2), 16) }
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([byte[]]$keyBytes)
  try {
    $data = [System.Text.Encoding]::UTF8.GetBytes($label)
    $hash = $hmac.ComputeHash($data)
    (($hash[0..15]) | ForEach-Object { $_.ToString("x2") }) -join ""
  }
  finally {
    $hmac.Dispose()
  }
}

function Normalize-Slug([string]$s) {
  ($s.Trim().ToLower() -replace '[^a-z0-9\-]', '-')
}

function Ensure-Dir([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    New-Item -ItemType Directory -Path $path | Out-Null
  }
}

Ensure-Dir $OutDir
$ClientSlug = Normalize-Slug $ClientSlug
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$kmsPath = Join-Path $OutDir $KmsFile
$kmsHex = $null

if ($Mode -eq "bootstrap" -or $Mode -eq "both") {
  if (Test-Path -LiteralPath $kmsPath) {
    $existing = Get-Content -LiteralPath $kmsPath | Where-Object { $_ -match '^KMS_MASTER_KEY_HEX=' }
    if ($existing) {
      $kmsHex = ($existing -replace '^KMS_MASTER_KEY_HEX=', '').Trim()
    }
  }

  if (-not $kmsHex) {
    $kmsHex = New-HexKey 32
    @(
      "KMS_MASTER_KEY_HEX=$kmsHex"
      "CREATED_AT=$(Get-Date -Format o)"
      "NOTE=This file stays private. Never send it to supplier."
    ) | Set-Content -LiteralPath $kmsPath -Encoding UTF8
  }
}

if ($Mode -eq "batch" -or $Mode -eq "both") {
  if (-not $kmsHex) {
    if (-not (Test-Path -LiteralPath $kmsPath)) {
      throw "KMS file not found. Run bootstrap/both first. Expected: $kmsPath"
    }
    $existing = Get-Content -LiteralPath $kmsPath | Where-Object { $_ -match '^KMS_MASTER_KEY_HEX=' }
    if (-not $existing) {
      throw "KMS_MASTER_KEY_HEX not found in $kmsPath"
    }
    $kmsHex = ($existing -replace '^KMS_MASTER_KEY_HEX=', '').Trim()
  }

  $kMeta = Get-Hmac16Hex $kmsHex ("meta:$ClientSlug:$BatchId")
  $kFile = Get-Hmac16Hex $kmsHex ("file:$ClientSlug:$BatchId")

  $supplierFile = Join-Path $OutDir ("supplier-keys-$ClientSlug-$BatchId-$timestamp.env")
  $backendFile  = Join-Path $OutDir ("backend-batch-$ClientSlug-$BatchId-$timestamp.env")

  @(
    "CLIENT_SLUG=$ClientSlug"
    "BATCH_ID=$BatchId"
    "K_META_BATCH=$kMeta"
    "K_FILE_BATCH=$kFile"
    "CREATED_AT=$(Get-Date -Format o)"
    "NOTE=Send ONLY K_META_BATCH and K_FILE_BATCH to supplier."
  ) | Set-Content -LiteralPath $supplierFile -Encoding UTF8

  @(
    "CLIENT_SLUG=$ClientSlug"
    "BATCH_ID=$BatchId"
    "K_META_BATCH=$kMeta"
    "K_FILE_BATCH=$kFile"
    "KMS_FILE=$kmsPath"
    "CREATED_AT=$(Get-Date -Format o)"
    "NOTE=Use these same batch keys when creating the batch in backend."
  ) | Set-Content -LiteralPath $backendFile -Encoding UTF8

  Write-Host "OK: batch files generated"
  Write-Host "Supplier file: $supplierFile"
  Write-Host "Backend file : $backendFile"
}

if ($Mode -eq "bootstrap" -or $Mode -eq "both") {
  Write-Host "KMS file: $kmsPath"
}
