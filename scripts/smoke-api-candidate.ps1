param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string]$DeploymentUrl,

  [string]$Scope = 'marcelos-projects-c26aa499'
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$apiRoot = Join-Path $workspaceRoot 'apps/api'
$smokeScript = Join-Path $workspaceRoot 'scripts/smoke-api-deployment.mjs'
$taskTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$taskEnvPath = [IO.Path]::GetFullPath(
  (Join-Path $taskTempRoot ('nexid-api-smoke-' + [guid]::NewGuid().ToString('N') + '.env'))
)

if (-not $taskEnvPath.StartsWith($taskTempRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to create the temporary environment file outside the system temp directory.'
}

try {
  $secretValue = [string]$env:NEXID_EDGE_ORIGIN_SECRET
  if (-not $secretValue -or $secretValue.Trim() -eq '[REDACTED]') {
    Push-Location $apiRoot
    try {
      & npx vercel@57.0.0 env pull $taskEnvPath --environment=production --yes --scope $Scope | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw 'Unable to read the linked API production environment from Vercel.'
      }
    }
    finally {
      Pop-Location
    }

    $secretLine = Get-Content -LiteralPath $taskEnvPath |
      Where-Object { $_ -match '^NEXID_EDGE_ORIGIN_SECRET=' } |
      Select-Object -First 1

    if (-not $secretLine) {
      throw 'NEXID_EDGE_ORIGIN_SECRET is missing. Run this smoke through `npx vercel env run -e production -- powershell ...`.'
    }

    $secretValue = $secretLine.Substring($secretLine.IndexOf('=') + 1).Trim()
    if (
      ($secretValue.StartsWith('"') -and $secretValue.EndsWith('"')) -or
      ($secretValue.StartsWith("'") -and $secretValue.EndsWith("'"))
    ) {
      $secretValue = $secretValue.Substring(1, $secretValue.Length - 2)
    }
  }

  if (-not $secretValue -or $secretValue.Trim() -eq '[REDACTED]') {
    throw 'Vercel returned a redacted edge-origin secret. Run this smoke through `npx vercel env run -e production -- powershell -NoProfile -ExecutionPolicy Bypass -File ..\..\scripts\smoke-api-candidate.ps1 -DeploymentUrl <fresh-url>`.'
  }

  function Invoke-CandidateRequest {
    param(
      [Parameter(Mandatory = $true)]
      [string]$Path,
      [ValidateSet('GET', 'POST')]
      [string]$Method = 'GET',
      [string]$Body = ''
    )

    $curlArgs = @(
      'vercel@57.0.0',
      'curl',
      $Path,
      '--deployment',
      $DeploymentUrl,
      '--yes',
      '--',
      '--include',
      '--silent',
      '--show-error',
      '--header',
      "x-nexid-edge-auth: $secretValue"
    )

    if ($Method -eq 'POST') {
      $curlArgs += @(
        '--request',
        'POST',
        '--header',
        'content-type: application/json',
        '--data',
        $Body
      )
    }

    Push-Location $apiRoot
    try {
      $responseText = (& npx @curlArgs) -join "`n"
      if ($LASTEXITCODE -ne 0) {
        throw "Vercel could not reach candidate endpoint $Path."
      }
    }
    finally {
      Pop-Location
    }

    $statusMatches = [regex]::Matches($responseText, '(?m)^HTTP/\S+\s+(\d{3})\b')
    if ($statusMatches.Count -eq 0) {
      throw "Candidate endpoint $Path did not expose an HTTP status line."
    }
    $statusCode = [int]$statusMatches[$statusMatches.Count - 1].Groups[1].Value

    $responseParts = [regex]::Split($responseText, "\r?\n\r?\n")
    $bodyText = $responseParts[$responseParts.Count - 1].Trim()

    try {
      $parsedBody = $bodyText | ConvertFrom-Json
    }
    catch {
      throw "Candidate endpoint $Path did not return valid JSON (HTTP $statusCode)."
    }

    return [pscustomobject]@{
      Status = $statusCode
      Body = $parsedBody
    }
  }

  $health = Invoke-CandidateRequest -Path '/health'
  $proof = Invoke-CandidateRequest -Path '/public/proof/demo-cases'
  $ownership = Invoke-CandidateRequest -Path '/public/polygon/ownership'
  $invalidSdk = Invoke-CandidateRequest -Path '/api/v1/sdk/verify' -Method 'POST' -Body '{}'

  if ($health.Status -ne 200 -or $health.Body.ok -ne $true) {
    throw 'Candidate health endpoint is not ready.'
  }
  if ($proof.Status -ne 200 -or $proof.Body.ok -ne $true -or $proof.Body.cases.Count -lt 3) {
    throw "Candidate public proof summary is incomplete (HTTP $($proof.Status), ok=$($proof.Body.ok), cases=$($proof.Body.cases.Count), reason=$($proof.Body.reason))."
  }
  if ($proof.Body.testnet.iota.rpc_verified -ne $true) {
    throw 'Candidate IOTA RPC evidence is not verified.'
  }
  if (
    $proof.Body.testnet.polygon.rpc_verified -ne $true -or
    $proof.Body.testnet.polygon.verification_state -ne 'confirmed'
  ) {
    throw 'Candidate Polygon proof summary is not confirmed.'
  }
  if (
    $ownership.Status -ne 200 -or
    $ownership.Body.ok -ne $true -or
    $ownership.Body.verification_state -ne 'confirmed' -or
    $ownership.Body.wallet_control.verified -ne $true -or
    $ownership.Body.metadata.document_ok -ne $true -or
    $ownership.Body.mint.events_match -ne $true
  ) {
    throw 'Candidate Polygon ownership evidence is incomplete.'
  }
  if ($invalidSdk.Status -ne 401 -or $invalidSdk.Body.reason -ne 'sdk_api_key_required') {
    throw "Candidate invalid SDK contract returned HTTP $($invalidSdk.Status)."
  }

  [pscustomobject]@{
    ok = $true
    deployment = $DeploymentUrl
    health = $health.Body.ok
    proof_cases = $proof.Body.cases.Count
    iota_rpc_verified = $proof.Body.testnet.iota.rpc_verified
    iota_verified_anchors = $proof.Body.testnet.iota.verified_anchor_count
    polygon_rpc_verified = $proof.Body.testnet.polygon.rpc_verified
    polygon_state = $proof.Body.testnet.polygon.verification_state
    polygon_token = $proof.Body.testnet.polygon.demo_token_id
    polygon_wallet_control = $ownership.Body.wallet_control.verified
    polygon_metadata = $ownership.Body.metadata.document_ok
    invalid_sdk_status = $invalidSdk.Status
  } | ConvertTo-Json -Compress
}
finally {
  if (
    (Test-Path -LiteralPath $taskEnvPath) -and
    $taskEnvPath.StartsWith($taskTempRoot, [StringComparison]::OrdinalIgnoreCase)
  ) {
    Remove-Item -LiteralPath $taskEnvPath -Force
  }
}
