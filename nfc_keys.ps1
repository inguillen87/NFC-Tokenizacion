param(
  [Parameter(Mandatory=$true)][string]$ClientSlug,
  [Parameter(Mandatory=$true)][string]$BatchId,
  [string]$OutDir = "./generated-keys",
  [string]$SecretsDir = "./secrets"
)

function New-HexKey([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return (($b | ForEach-Object { $_.ToString("x2") }) -join "").ToUpper()
}

function Get-HmacHex([string]$keyHex, [string]$message) {
  $key = for ($i=0; $i -lt $keyHex.Length; $i+=2) { [Convert]::ToByte($keyHex.Substring($i,2),16) }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($message)
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([byte[]]$key)
  try {
    $hash = $hmac.ComputeHash($bytes)
    $hex = (($hash | ForEach-Object { $_.ToString("x2") }) -join "").ToUpper()
    return $hex.Substring(0,32)
  }
  finally {
    $hmac.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $SecretsDir | Out-Null
$kmsFile = Join-Path $SecretsDir "kms-master.env"
if (!(Test-Path $kmsFile)) {
  $kms = New-HexKey 32
  "KMS_MASTER_KEY_HEX=$kms" | Set-Content -Encoding ascii $kmsFile
} else {
  $kms = (Get-Content $kmsFile | Select-String "^KMS_MASTER_KEY_HEX=").ToString().Split("=")[1].Trim()
}

$kMeta = Get-HmacHex $kms ("meta:" + $ClientSlug + ":" + $BatchId)
$kFile = Get-HmacHex $kms ("file:" + $ClientSlug + ":" + $BatchId)
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$base = Join-Path $OutDir ("nfc-keys-" + $ClientSlug + "-" + $BatchId + "-" + $ts)

@(
  "CLIENT_SLUG=$ClientSlug",
  "BATCH_ID=$BatchId",
  "GENERATED_AT=" + (Get-Date).ToString("s"),
  "K_META_BATCH=$kMeta",
  "K_FILE_BATCH=$kFile"
) | Set-Content -Encoding ascii ($base + ".env")

@(
  "BATCH_ID=$BatchId",
  "K_META_BATCH=$kMeta",
  "K_FILE_BATCH=$kFile"
) | Set-Content -Encoding ascii ($base + "-supplier.txt")

Write-Host "Master file: $kmsFile"
Write-Host "Backend file: $($base + '.env')"
Write-Host "Supplier file: $($base + '-supplier.txt')"
