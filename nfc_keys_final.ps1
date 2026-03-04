param(
  [Parameter(Mandatory=$true)][string]$BatchId,
  [string]$OutDir = ".\\generated-keys",
  [string]$SecretsDir = ".\\secrets"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-Hex([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return (($b | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Hmac-Hex([string]$keyHex, [string]$message) {
  $keyBytes = for ($i=0; $i -lt $keyHex.Length; $i+=2) { [Convert]::ToByte($keyHex.Substring($i,2),16) }
  $msgBytes = [System.Text.Encoding]::UTF8.GetBytes($message)
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([byte[]]$keyBytes)
  try {
    $hash = $hmac.ComputeHash($msgBytes)
    return (($hash | ForEach-Object { $_.ToString('x2') }) -join '')
  } finally {
    $hmac.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $SecretsDir | Out-Null
$masterFile = Join-Path $SecretsDir 'kms-master.env'

if (-not (Test-Path $masterFile)) {
  $kms = New-Hex 32
  @(
    "KMS_MASTER_KEY_HEX=$kms"
  ) | Set-Content -Path $masterFile -Encoding UTF8
} else {
  $kms = (Get-Content $masterFile | Select-String '^KMS_MASTER_KEY_HEX=').ToString().Split('=')[1].Trim()
}

$kMeta = (Hmac-Hex $kms ("meta:" + $BatchId)).Substring(0,32)
$kFile = (Hmac-Hex $kms ("file:" + $BatchId)).Substring(0,32)
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$base = "nfc-keys-$BatchId-$ts"
$privateEnv = Join-Path $OutDir ($base + '.private.env')
$backendEnv = Join-Path $OutDir ($base + '.backend.env')
$supplierTxt = Join-Path $OutDir ($base + '.supplier.txt')

@(
  "BATCH_ID=$BatchId",
  "KMS_MASTER_KEY_HEX=$kms",
  "K_META_BATCH=$kMeta",
  "K_FILE_BATCH=$kFile"
) | Set-Content -Path $privateEnv -Encoding UTF8

@(
  "BATCH_ID=$BatchId",
  "K_META_BATCH=$kMeta",
  "K_FILE_BATCH=$kFile"
) | Set-Content -Path $backendEnv -Encoding UTF8

@(
  "Batch ID: $BatchId",
  "K_META_BATCH: $kMeta",
  "K_FILE_BATCH: $kFile"
) | Set-Content -Path $supplierTxt -Encoding UTF8

Write-Host "OK"
Write-Host "Master saved in: $masterFile"
Write-Host "Private file: $privateEnv"
Write-Host "Backend file: $backendEnv"
Write-Host "Supplier file: $supplierTxt"
