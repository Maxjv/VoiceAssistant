param(
    [switch]$WaitReadyOnly,
    [switch]$OpenBrowserOnly
)

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }

if ($OpenBrowserOnly) {
    $url = $null
    if (Test-Path (Join-Path $root "current-url.txt")) {
        $content = (Get-Content (Join-Path $root "current-url.txt") -Raw -ErrorAction SilentlyContinue)
        if ($content -and ($content.Trim() -match "trycloudflare\.com")) {
            $url = $content.Trim()
        }
    }
    $context = ""
    $envPath = Join-Path $root ".env"
    if (Test-Path $envPath) {
        $match = Get-Content $envPath | Where-Object { $_ -match "^CONTEXT_PATH=(.*)$" }
        if ($match) { $context = $match -replace "^CONTEXT_PATH=","" }
    }
    $targetUrl = if ($url) { $url } else { "http://localhost:4000" }
    if ($context) {
        $targetUrl = "$targetUrl/?context=" + [System.Uri]::EscapeDataString($context)
    }
    Start-Process $targetUrl
    exit 0
}

# Flujo de inicio / espera:
Remove-Item (Join-Path $root "stop.txt") -Force -ErrorAction SilentlyContinue

$isAppRunning = Get-Process -Name "AnywhereDesignServer" -ErrorAction SilentlyContinue
if (-not $isAppRunning) {
    Remove-Item (Join-Path $root "current-url.txt") -Force -ErrorAction SilentlyContinue
    Start-Process "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\watchdog.ps1`"" -WindowStyle Hidden
}

# Esperar a que Cloudflare conecte y escriba la URL
$counter = 0
$url = $null
while ($counter -lt 40) {
    $counter++
    Start-Sleep -Seconds 1
    if (Test-Path (Join-Path $root "current-url.txt")) {
        $content = (Get-Content (Join-Path $root "current-url.txt") -Raw -ErrorAction SilentlyContinue)
        if ($content -and ($content.Trim() -match "trycloudflare\.com")) {
            $url = $content.Trim()
            break
        }
    }
}

# Esperar a que el servidor HTTP responda 200 OK
for ($i = 0; $i -lt 30; $i++) {
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:4000/api/check-target" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        if ($res.StatusCode -eq 200) { break }
    } catch { }
    Start-Sleep -Milliseconds 500
}

# Si fue llamado con -WaitReadyOnly, termina aqui sin tocar el navegador
if ($WaitReadyOnly) {
    exit 0
}

# Si fue llamado desde el acceso directo (sin parametros), abre el navegador directamente a la web
$context = ""
$envPath = Join-Path $root ".env"
if (Test-Path $envPath) {
    $match = Get-Content $envPath | Where-Object { $_ -match "^CONTEXT_PATH=(.*)$" }
    if ($match) { $context = $match -replace "^CONTEXT_PATH=","" }
}
$targetUrl = if ($url) { $url } else { "http://localhost:4000" }
if ($context) {
    $targetUrl = "$targetUrl/?context=" + [System.Uri]::EscapeDataString($context)
}
Start-Process $targetUrl
