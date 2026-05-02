param(
  [string]$ApiBase = "https://api.nexid.lat",
  [string]$TenantSlug = "demobodega",
  [string]$MemberKey = ""
)

$ErrorActionPreference = "Stop"

$query = "tenantSlug=$([uri]::EscapeDataString($TenantSlug))"
if ($MemberKey) { $query += "&memberKey=$([uri]::EscapeDataString($MemberKey))" }

$url = $ApiBase.TrimEnd("/") + "/mobile/loyalty/overview?$query"

try {
  $result = Invoke-RestMethod -Method GET -Uri $url
} catch {
  Write-Host ""
  Write-Host "nexID loyalty overview fallo" -ForegroundColor Red
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
Write-Host "nexID loyalty overview" -ForegroundColor Cyan
Write-Host "Endpoint: $url"
Write-Host ""

$result | ConvertTo-Json -Depth 8
