param(
    [switch]$All,
    [string]$Source = "linkedin",
    [int]$WaitSeconds = 10
)

$ErrorActionPreference = "Stop"
$backendRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path (Split-Path -Parent $backendRoot) "frontend"

function Read-EnvValue([string]$Path, [string]$Name) {
    $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
    if (-not $line) { throw "$Name is missing from $Path" }
    return ($line -split "=", 2)[1].Trim().Trim('"')
}

$backendEnv = Join-Path $backendRoot ".env"
$frontendEnv = Join-Path $frontendRoot ".env"
$serviceUrl = "http://127.0.0.1:8000"
$portalUrl = "http://127.0.0.1:3000"
$serviceKey = Read-EnvValue $backendEnv "SERVICE_API_KEY"

$health = Invoke-WebRequest -UseBasicParsing "$serviceUrl/health" -TimeoutSec 10
if ($health.StatusCode -ne 200) { throw "Backend health check failed" }

$sourceBody = if ($All) { "{}" } else { "{`"source`":`"$Source`"}" }
$trigger = Invoke-WebRequest -UseBasicParsing "$serviceUrl/crawl/all" `
    -Method Post `
    -Headers @{"x-api-key" = $serviceKey; "Content-Type" = "application/json"} `
    -Body $sourceBody `
    -TimeoutSec 30

Write-Output ("Queued crawl: {0}" -f $trigger.Content)
Write-Output "Waiting $WaitSeconds seconds for the worker to publish jobs..."
Start-Sleep -Seconds $WaitSeconds

$jobs = Invoke-WebRequest -UseBasicParsing "$portalUrl/api/jobs?limit=1" -TimeoutSec 20
if ($jobs.StatusCode -ne 200) { throw "Portal jobs API check failed" }

Write-Output "Pipeline check passed: backend accepted the crawl and the portal jobs API is reachable."
