param(
  [string]$ApiBase = "https://api.nexid.lat",
  [string]$AdminApiKey
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
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
  }
}

$key = Read-AdminKey
if (-not $key) {
  throw "ADMIN_API_KEY is required."
}

$url = "$($ApiBase.TrimEnd('/'))/admin/schema/bootstrap"
$headers = @{
  "authorization" = "Bearer $key"
  "x-admin-api-key" = $key
}

Write-Host ""
Write-Host "nexID commercial schema bootstrap"
Write-Host "Endpoint: $url"

$result = Invoke-RestMethod -Method POST -Uri $url -Headers $headers
$json = $result | ConvertTo-Json -Depth 8
Write-Host $json

if (-not $result.ok) {
  exit 1
}

Write-Host ""
Write-Host "READY: leads, tickets, notifications, consumer portal, marketplace and carrier profiles are available."
