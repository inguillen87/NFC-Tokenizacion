param(
  [string]$ApiBase = "https://api.nexid.lat",
  [string]$AdminSessionToken
)

$ErrorActionPreference = "Stop"

function Read-AdminSessionToken {
  if ($AdminSessionToken) {
    return $AdminSessionToken.Trim()
  }

  $secure = Read-Host "Paste an active nexID admin session token (input hidden)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
  } finally {
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
  }
}

$sessionToken = Read-AdminSessionToken
if (-not $sessionToken) {
  throw "An active admin session token is required."
}

$url = "$($ApiBase.TrimEnd('/'))/admin/schema/bootstrap"
$headers = @{
  "authorization" = "Bearer $sessionToken"
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
