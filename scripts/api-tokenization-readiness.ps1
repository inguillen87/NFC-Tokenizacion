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
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

$key = Read-AdminKey
if (-not $key) {
  throw "ADMIN_API_KEY vacio"
}

$url = $ApiBase.TrimEnd("/") + "/admin/polygon/wallet"
$headers = @{
  "Authorization" = "Bearer $key"
  "x-nexid-admin-scope" = "super_admin"
}

$result = Invoke-RestMethod -Method GET -Uri $url -Headers $headers

Write-Host ""
Write-Host "nexID API tokenization readiness" -ForegroundColor Cyan
Write-Host "Endpoint: $url"
Write-Host "Mode: $($result.mode)"
Write-Host "Ready: $($result.ready)"
Write-Host "Network: $($result.network)"
Write-Host "Chain ID: $($result.chainId)"
Write-Host "Contract: $($result.contract.address) deployed=$($result.contract.deployed)"
Write-Host "Minter: $($result.minter.address) gas=$($result.minter.balancePol) POL"
Write-Host "Recipient: $($result.recipient.address) gas=$($result.recipient.balancePol) POL"
Write-Host ""

foreach ($check in $result.checks) {
  $color = "White"
  if ($check.status -eq "pass") { $color = "Green" }
  if ($check.status -eq "warn") { $color = "Yellow" }
  if ($check.status -eq "fail") { $color = "Red" }
  Write-Host ("{0,-5} {1} - {2}" -f $check.status.ToUpper(), $check.label, $check.detail) -ForegroundColor $color
}

Write-Host ""
if ($result.ready -eq $true) {
  Write-Host "READY: API puede tokenizar en Polygon Amoy." -ForegroundColor Green
  exit 0
}

Write-Host "NOT READY: revisar checks FAIL/WARN antes del tap real." -ForegroundColor Yellow
exit 2
