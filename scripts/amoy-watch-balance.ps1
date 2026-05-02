param(
  [Parameter(Mandatory = $true)]
  [string]$Address,

  [string]$Rpc = "https://polygon-amoy.drpc.org",

  [string]$Min = "0.001",

  [string]$Interval = "20",

  [switch]$Once
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$watchScript = Join-Path $repoRoot "apps\api\scripts\watch-amoy-balance.mjs"
$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (Test-Path $bundledNode) {
  $node = $bundledNode
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
  $node = "node"
} else {
  throw "No encontre node.exe. Instala Node.js o verifica $bundledNode"
}

$argsList = @($watchScript, "--address", $Address, "--rpc", $Rpc, "--min", $Min, "--interval", $Interval)
if ($Once) {
  $argsList += "--once"
}

& $node @argsList
