param(
  [switch]$SkipCleanup,
  [switch]$SkipWebSocket,
  [string[]]$Script = @(),
  [string]$K6,
  [string]$Psql
)

$ErrorActionPreference = 'Stop'

if (-not $K6)   { $K6   = if ($env:K6_PATH)   { $env:K6_PATH }   else { 'k6' } }
if (-not $Psql) { $Psql = if ($env:PSQL_PATH) { $env:PSQL_PATH } else { 'psql' } }

function Resolve-Tool {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string]$EnvVar,
    [Parameter(Mandatory = $true)][string]$InstallHint
  )

  $candidate = Get-Command $Command -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($candidate) { return $candidate.Source }

  if (Test-Path -LiteralPath $Command -PathType Leaf) {
    return (Resolve-Path -LiteralPath $Command).Path
  }

  throw @"
Could not find '$Command'.
Install it, or point this script at it:
  - pass -K6 <path> / -Psql <path> to this script, or
  - set the $EnvVar environment variable to the full path.
$InstallHint
"@
}

$k6Exe = Resolve-Tool -Command $K6 -EnvVar 'K6_PATH' `
  -InstallHint 'Install k6 from https://grafana.com/docs/k6/latest/set-up/install-k6/ (Windows: winget install k6).'
$psqlExe = Resolve-Tool -Command $Psql -EnvVar 'PSQL_PATH' `
  -InstallHint 'Install the PostgreSQL client, or use the psql.exe bundled with your PostgreSQL installation.'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$results = Join-Path $root 'results'
if (-not (Test-Path -LiteralPath $results)) {
  New-Item -ItemType Directory -Path $results | Out-Null
}

$allScripts = @('smoke.js', 'auth.js', 'read-heavy.js', 'write-heavy.js', 'mixed.js')
if (-not $SkipWebSocket) {
  $allScripts += 'websocket.js'
}

if ($Script.Count -gt 0) {
  $selected = foreach ($name in $Script) {
    $normalized = if ($name -like '*.js') { $name } else { "$name.js" }
    if ($allScripts -notcontains $normalized) {
      throw "Unknown script '$name'. Choose from: $($allScripts -join ', ')."
    }
    $normalized
  }
  $scripts = @($selected | Select-Object -Unique)
} else {
  $scripts = $allScripts
}

Push-Location $root
try {
  $outcomes = @()
  foreach ($scenario in $scripts) {
    Write-Host "=== Running $scenario ===" -ForegroundColor Cyan
    $log = Join-Path $results ("run-{0}.log" -f ($scenario -replace '\.js$', ''))
    & $k6Exe run $scenario *> $log
    $code = $LASTEXITCODE
    $outcomes += [PSCustomObject]@{ Script = $scenario; ExitCode = $code }
    if ($code -ne 0) {
      Write-Host "$scenario exited with $code (check $log)" -ForegroundColor Yellow
    }
  }

  Write-Host ''
  Write-Host '=== Run outcomes ==='
  $outcomes | Format-Table -AutoSize

  if (-not $SkipCleanup) {
    Write-Host '=== Cleaning up disposable k6 users ===' -ForegroundColor Cyan
    & $psqlExe -U postgres -d typing_db -f (Join-Path $root 'cleanup.sql')
  }
}
finally {
  Pop-Location
}
