param(
    [switch]$WaitReadyOnly,
    [switch]$OpenBrowserOnly
)

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }

function Get-CloudflareUrl {
    $url = $null
    # 1. Leer de current-url.txt
    $urlFile = Join-Path $root "current-url.txt"
    if (Test-Path $urlFile) {
        $content = (Get-Content $urlFile -Raw -ErrorAction SilentlyContinue)
        if ($content -and ($content.Trim() -match "^https:\/\/[a-z0-9-]+\.trycloudflare\.com")) {
            $url = $content.Trim()
        }
    }
    # 2. Si no esta en el archivo, leer directamente de cloudflared.err.log
    if (-not $url) {
        $errFile = Join-Path $root "cloudflared.err.log"
        if (Test-Path $errFile) {
            $found = Select-String -Path $errFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -Last 1
            if ($found) {
                $url = $found.Matches[0].Value.Trim()
                Set-Content -Path $urlFile -Value $url -NoNewline -ErrorAction SilentlyContinue
            }
        }
    }
    return $url
}

if ($OpenBrowserOnly) {
    # Esperar activamente a tener la URL de Cloudflare (NO abrir localhost)
    $url = $null
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $url = Get-CloudflareUrl
        if ($url) { break }
        Start-Sleep -Seconds 1
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
    Start-Process "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\watchdog.ps1`"" -WindowStyle Hidden
}

# 1. Esperar activamente a que Cloudflare enganche y escriba la URL (hasta 60s)
$url = $null
$counter = 0
while ($counter -lt 60) {
    $counter++
    $url = Get-CloudflareUrl
    if ($url) { break }
    Start-Sleep -Seconds 1
}

# 2. Esperar a que el servidor HTTP responda 200 OK (proyecto listo)
for ($i = 0; $i -lt 40; $i++) {
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

# Si fue llamado desde el acceso directo (sin parametros), abre el navegador directamente a Cloudflare
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
