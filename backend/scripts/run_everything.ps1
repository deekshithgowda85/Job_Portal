param(
    [int]$WaitSeconds = 15,
    [switch]$CompanyCareers
)

$ErrorActionPreference = "Stop"
$backendRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $backendRoot
$frontendRoot = Join-Path $projectRoot "frontend"
$python = Join-Path $backendRoot ".venv\Scripts\python.exe"
$celery = Join-Path $backendRoot ".venv\Scripts\celery.exe"
$serviceUrl = "http://127.0.0.1:8000"
$portalUrl = "http://127.0.0.1:3000"
$backendEnv = Join-Path $backendRoot ".env"
$logRoot = Join-Path $backendRoot "logs"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

function Read-EnvValue([string]$Path, [string]$Name) {
    $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
    if (-not $line) { throw "$Name is missing from $Path" }
    return ($line -split "=", 2)[1].Trim().Trim('"')
}

function Wait-ForUrl([string]$Url, [string]$Name) {
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch {}
        Start-Sleep -Seconds 2
    }
    throw "$Name did not become ready at $Url"
}

function Start-IfPortFree([int]$Port, [string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory, [string]$LogPath) {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        Write-Output "Port $Port is already in use; leaving the existing service running."
        return
    }

    $command = "& '" + $FilePath + "' " + (($Arguments | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" }) -join " ") + " *> '" + $LogPath + "'"
    Start-Process powershell.exe -WindowStyle Minimized -WorkingDirectory $WorkingDirectory -ArgumentList @("-NoProfile", "-Command", $command) | Out-Null
}

if (-not (Test-Path -LiteralPath $python)) { throw "Python virtual environment not found: $python" }
if (-not (Test-Path -LiteralPath $celery)) { throw "Celery executable not found: $celery" }

Start-IfPortFree 8000 $python @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000") $backendRoot (Join-Path $logRoot "uvicorn.log")
Start-IfPortFree 3000 (Join-Path $frontendRoot "node_modules\.bin\next.cmd") @("dev") $frontendRoot (Join-Path $logRoot "next.log")

$worker = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match "celery_app worker" -and $_.CommandLine -match [regex]::Escape($backendRoot)
}
if (-not $worker) {
    $workerCommand = "& '" + $celery + "' -A celery_app worker --loglevel=info -Q crawl,default --pool=solo --concurrency=1 *> '" + (Join-Path $logRoot "celery.log") + "'"
    Start-Process powershell.exe -WindowStyle Minimized -WorkingDirectory $backendRoot -ArgumentList @("-NoProfile", "-Command", $workerCommand) | Out-Null
} else {
    Write-Output "Celery worker is already running."
}

Wait-ForUrl "$serviceUrl/health" "backend"
Wait-ForUrl "$portalUrl/api/jobs" "frontend"

$serviceKey = Read-EnvValue (Join-Path $backendRoot ".env") "SERVICE_API_KEY"
$cleanup = Invoke-WebRequest -UseBasicParsing "$portalUrl/api/maintenance/cleanup" `
    -Method Post `
    -Headers @{"x-api-key" = (Read-EnvValue (Join-Path $frontendRoot ".env") "CRAWLER_API_KEY"); "Content-Type" = "application/json"} `
    -Body '{"retention_days":7}' `
    -TimeoutSec 30
Write-Output ("Retention cleanup: {0}" -f $cleanup.Content)

$sourceBody = if ($CompanyCareers) { '{"source":"generic"}' } else { "{}" }
$trigger = Invoke-WebRequest -UseBasicParsing "$serviceUrl/crawl/all" `
    -Method Post `
    -Headers @{"x-api-key" = $serviceKey; "Content-Type" = "application/json"} `
    -Body $sourceBody `
    -TimeoutSec 30
Write-Output ("Crawls queued: {0}" -f $trigger.Content)
Write-Output "Frontend: $portalUrl"
Write-Output "Company careers: $portalUrl/company-careers"
Write-Output "Waited $WaitSeconds seconds before checking ingestion."
Start-Sleep -Seconds $WaitSeconds
$jobs = Invoke-RestMethod "$portalUrl/api/jobs"
Write-Output ("Visible eligible jobs: {0}" -f $jobs.total)
