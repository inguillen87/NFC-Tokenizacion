param(
  [string]$ApiBase = "https://api.nexid.lat",
  [string]$AdminApiKey,
  [int]$Limit = 10,
  [string]$Tenant = "",
  [string]$Status = ""
)

$ErrorActionPreference = "Stop"

function Read-AdminKey {
  if ($AdminApiKey) {
    return $AdminApiKey.Trim()
  }

  $secure = Read-Host "Paste ADMIN_API_KEY (input hidden)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

$key = Read-AdminKey
if (-not $key) {
  throw "ADMIN_API_KEY vacio"
}

$query = "limit=$Limit"
if ($Tenant) { $query += "&tenant=$([uri]::EscapeDataString($Tenant))" }
if ($Status) { $query += "&status=$([uri]::EscapeDataString($Status))" }

$url = $ApiBase.TrimEnd("/") + "/admin/tokenization/requests?$query"
$headers = @{
  "Authorization" = "Bearer $key"
  "x-nexid-admin-scope" = "super_admin"
}

try {
  $result = Invoke-RestMethod -Method GET -Uri $url -Headers $headers
} catch {
  Write-Host ""
  Write-Host "nexID tokenization requests fallo" -ForegroundColor Red
  Write-Host "Endpoint: $url"
  $response = $_.Exception.Response
  if ($response) {
    Write-Host "HTTP: $([int]$response.StatusCode) $($response.StatusDescription)" -ForegroundColor Red
    try {
      $stream = $response.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $body = $reader.ReadToEnd()
      if ($body) {
        Write-Host ""
        Write-Host "Respuesta API:" -ForegroundColor Yellow
        Write-Host $body
      }
    } catch {
      Write-Host "No se pudo leer el cuerpo del error."
    }
  } else {
    Write-Host $_.Exception.Message -ForegroundColor Red
  }
  exit 1
}

Write-Host ""
Write-Host "nexID latest tokenization requests" -ForegroundColor Cyan
Write-Host "Endpoint: $url"
Write-Host ""

if (-not $result.rows -or $result.rows.Count -eq 0) {
  Write-Host "No hay tokenization requests todavia." -ForegroundColor Yellow
  exit 0
}

$result.rows | Select-Object `
  id,
  status,
  network,
  tenant_slug,
  bid,
  token_id,
  tx_hash,
  requested_at,
  anchored_at,
  last_error | Format-Table -AutoSize -Wrap
