param(
    [switch]$WaitReadyOnly,
    [switch]$OpenBrowserOnly
)

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $root -or -not (Test-Path $root)) { $root = (Get-Location).Path }
Set-Location $root

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

function Log-Launcher($msg) {
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path (Join-Path $root "launcher.log") -Value "[$time] $msg" -ErrorAction SilentlyContinue
}

function Get-BrowserPath {
    $candidates = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($path in $candidates) {
        if ($path -and (Test-Path $path)) { return $path }
    }
    
    try {
        $reg = (Get-ItemProperty 'Registry::HKEY_CLASSES_ROOT\ChromeHTML\shell\open\command' -ErrorAction SilentlyContinue).'(default)'
        if ($reg -and ($reg -match '"([^"]+)"')) {
            $regPath = $matches[1]
            if (Test-Path $regPath) { return $regPath }
        }
    } catch { }

    return $null
}

function Open-InBrowser($target) {
    Log-Launcher "Llamando a Open-InBrowser con destino: $target"
    $browser = Get-BrowserPath
    if ($browser) {
        Log-Launcher "Navegador encontrado: $browser"
        try {
            Start-Process -FilePath $browser -ArgumentList @($target) -WindowStyle Normal
            Log-Launcher "Navegador iniciado exitosamente con: $target"
            return
        } catch {
            Log-Launcher "Error iniciando navegador ($browser): $_"
        }
    }

    try {
        Start-Process $target -WindowStyle Normal
        Log-Launcher "Start-Process ejecutado exitosamente para: $target"
    } catch {
        Log-Launcher "Start-Process fallo ($_) - usando Process.Start"
        try {
            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = [string]$target
            $psi.UseShellExecute = $true
            $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal
            [System.Diagnostics.Process]::Start($psi)
        } catch {
            Log-Launcher "Process.Start fallo: $_"
        }
    }
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
    Open-InBrowser $targetUrl
    exit 0
}

# Flujo de inicio:
Remove-Item (Join-Path $root "stop.txt") -Force -ErrorAction SilentlyContinue

# Comprobar si watchdog ya está supervisando
$watchdogRunning = $false
try {
    $psProcs = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $psProcs) {
        if ($p.CommandLine -and $p.CommandLine -like "*watchdog.ps1*") {
            $watchdogRunning = $true
            break
        }
    }
} catch { }

if (-not $watchdogRunning) {
    Log-Launcher "Watchdog no detectado, arrancando watchdog.ps1..."
    Remove-Item (Join-Path $root "current-url.txt") -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $root "cloudflared.err.log") -Force -ErrorAction SilentlyContinue
    Start-Process "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\watchdog.ps1`"" -WindowStyle Hidden
}

# Si fue llamado durante la instalación con -WaitReadyOnly:
# Espera activamente hasta que Cloudflare y el proyecto estén 100% listos antes de mostrar el PIN al usuario
if ($WaitReadyOnly) {
    $url = $null
    $counter = 0
    while ($counter -lt 90) {
        $counter++
        $url = Get-CloudflareUrl
        if ($url) { break }
        Start-Sleep -Seconds 1
    }

    for ($i = 0; $i -lt 180; $i++) {
        try {
            $res = Invoke-WebRequest -Uri "http://127.0.0.1:4000/api/check-target" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($res -and $res.StatusCode -eq 200) {
                $data = $res.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($data -and $data.ready -eq $true) {
                    break
                }
            }
        } catch { }
        Start-Sleep -Seconds 1
    }

    # REGLA DEL USUARIO: 10 segundos extra tras terminar de compilar antes de lanzar el popup del PIN
    Start-Sleep -Seconds 10
    exit 0
}

# Si fue llamado desde el acceso directo (sin parámetros):
# APERTURA INSTANTÁNEA respetando los 3 casos:
# CASO A / C: Si Cloudflare está levantado y tiene URL válida, abre directo en la URL de Cloudflare.
# CASO B: Si Cloudflare NO está levantado aún, abre de inmediato en http://localhost:4000/splash.html
#         (splash.html espera que Cloudflare y el proyecto compilen en conjunto y migra solo a la URL).

$context = ""
$pin = ""
$envPath = Join-Path $root ".env"
if (Test-Path $envPath) {
    $match = Get-Content $envPath | Where-Object { $_ -match "^CONTEXT_PATH=(.*)$" }
    if ($match) { $context = ($match -replace "^CONTEXT_PATH=","").Trim() }
    $pinMatch = Get-Content $envPath | Where-Object { $_ -match "^ACCESS_PIN=(.*)$" }
    if ($pinMatch) { $pin = ($pinMatch -replace "^ACCESS_PIN=","").Trim() }
}

function Test-CloudflareUrlValid($testUrl) {
    if (-not $testUrl) { return $false }
    try {
        $uri = [System.Uri]$testUrl
        $entry = [System.Net.Dns]::GetHostAddresses($uri.Host)
        if ($entry -and $entry.Count -gt 0) { return $true }
    } catch { }
    return $false
}

# 1. Asegurar que el servidor local en puerto 4000 responda
Log-Launcher "Comprobando servidor local en puerto 4000..."
$serverReady = $false
for ($w = 0; $w -lt 25; $w++) {
    try {
        $pong = Invoke-WebRequest -Uri "http://127.0.0.1:4000/api/check-target" -TimeoutSec 1 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($pong -and $pong.StatusCode -eq 200) { 
            $serverReady = $true
            Log-Launcher "Servidor local en puerto 4000 respondiendo OK."
            break 
        }
    } catch { }
    Start-Sleep -Milliseconds 300
}

# 2. Ping a todo dios: verificar si Cloudflare y el proyecto ya estan 100% compilados y en linea
$isEverythingReady = $false
$readyUrl = $null
if ($serverReady) {
    try {
        $checkUri = "http://127.0.0.1:4000/api/ready-url"
        if ($context) { $checkUri += "?context=" + [System.Uri]::EscapeDataString($context) }
        $res = Invoke-RestMethod -Uri $checkUri -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($res -and $res.ready -eq $true -and $res.url) {
            if (Test-CloudflareUrlValid $res.url) {
                $isEverythingReady = $true
                $readyUrl = $res.url
            }
        }
    } catch { }
}

# 3. Decision de apertura:
# Si TODO esta 100% levantado y compilado -> abre la URL final directamente.
# Si algo esta levantando, compilando o Cloudflare no esta listo -> SIEMPRE abre splash.html en localhost.
if ($isEverythingReady -and $readyUrl) {
    Log-Launcher "Todo 100% en linea y compilado. Abriendo destino directo: $readyUrl"
    $targetUrl = $readyUrl
} else {
    Log-Launcher "Entorno iniciandose o compilando. Abriendo splash.html en localhost..."
    $targetUrl = "http://localhost:4000/splash.html"
    if ($context) {
        $targetUrl = "http://localhost:4000/splash.html?context=" + [System.Uri]::EscapeDataString($context)
    }
}

Open-InBrowser $targetUrl
exit 0
