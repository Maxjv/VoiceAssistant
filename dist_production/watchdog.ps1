# ==============================================================================
# WATCHDOG OFICIAL TFTE VOICE ASSISTANT (A PRUEBA DE FALLOS)
# ==============================================================================
$ErrorActionPreference = "Continue"

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }
Set-Location $root
$Port = 4000
$CHECK_INTERVAL_SEC = 20

# CHIVATO: Escribe todo lo que piensa el Watchdog
function Log-Msg($msg) {
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path (Join-Path $root "watchdog_debug.log") -Value "[$time] $msg"
    Write-Host "[$time] $msg" -ForegroundColor Cyan
}

Log-Msg "INICIANDO WATCHDOG EN CARPETA: $root"

$IsDevMode = $false
$globalEnvPath = Join-Path $root ".env"
if (Test-Path $globalEnvPath) {
    $envLines = Get-Content $globalEnvPath
    if ($envLines -match "^ENV=development$") { $IsDevMode = $true }
}

function Test-Alive($processId) {
    if (-not $processId) { return $false }
    return [bool](Get-Process -Id $processId -ErrorAction SilentlyContinue)
}

function Start-Server {
    if ($IsDevMode) {
        Log-Msg "Modo DESARROLLO detectado. Arrancando servidor Node (node server.js)..."
        return (Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $root `
            -RedirectStandardOutput (Join-Path $root "server.log") -RedirectStandardError (Join-Path $root "server.err.log") `
            -WindowStyle Hidden -PassThru).Id
    } else {
        Log-Msg "Modo PRODUCCION detectado. Arrancando servidor compilado (AnywhereDesignServer.exe)..."
        $exe = Join-Path $root "AnywhereDesignServer.exe"
        return (Start-Process -FilePath $exe -WorkingDirectory $root `
            -RedirectStandardOutput (Join-Path $root "server.log") -RedirectStandardError (Join-Path $root "server.err.log") `
            -WindowStyle Hidden -PassThru).Id
    }
}

# AUTO-DESCUBRIMIENTO DE REACT BLINDADO
function Start-ReactApp {
    Log-Msg "Buscando contexto para React..."
    
    $contextPath = $null
    if (Test-Path $globalEnvPath) {
        $envLines = Get-Content $globalEnvPath
        $match = $envLines -match "^CONTEXT_PATH=(.*)$"
        if ($match) {
            $contextPath = $match[0].Replace("CONTEXT_PATH=","").Trim()
            Log-Msg "Leido del .env -> CONTEXT_PATH=$contextPath"
        }
    }
    
    if (-not $contextPath) { 
        Log-Msg "Abortando React: CONTEXT_PATH esta vacio."
        return $null 
    }
    if (-not (Test-Path $contextPath)) { 
        Log-Msg "Abortando React: La ruta $contextPath NO existe en tu PC."
        return $null 
    }

    $reactDir = $null
    
    # 1. Buscar en la carpeta raíz
    if (Test-Path (Join-Path $contextPath "package.json")) {
        $pkgRaw = Get-Content (Join-Path $contextPath "package.json") -Raw -ErrorAction SilentlyContinue
        if ($pkgRaw -and ($pkgRaw -notmatch '"name"\s*:\s*"voiceassistant"')) {
            $reactDir = $contextPath
        }
    }

    # 2. Buscar en subcarpetas inmediatas (ej: voice-command-dev, frontend, client)
    if (-not $reactDir) {
        $subfolders = Get-ChildItem -Path $contextPath -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "node_modules" -and -not $_.Name.StartsWith(".") }
        foreach ($sub in $subfolders) {
            if (Test-Path (Join-Path $sub.FullName "package.json")) {
                $pkg = Get-Content (Join-Path $sub.FullName "package.json") -Raw -ErrorAction SilentlyContinue
                if ($pkg -and ($pkg -notmatch '"name"\s*:\s*"voiceassistant"')) {
                    $reactDir = $sub.FullName
                    break
                }
            }
        }
    }

    # 3. Solo si no encontró, buscar hacia arriba
    if (-not $reactDir) {
        $searchDir = Split-Path $contextPath -Parent
        while ($searchDir -and (Test-Path $searchDir)) {
            if (Test-Path (Join-Path $searchDir "package.json")) {
                $pkgRaw = Get-Content (Join-Path $searchDir "package.json") -Raw -ErrorAction SilentlyContinue
                if ($pkgRaw -and ($pkgRaw -notmatch '"name"\s*:\s*"voiceassistant"')) {
                    $reactDir = $searchDir
                    break
                }
            }
            $parent = Split-Path $searchDir -Parent
            if ($parent -eq $searchDir) { break }
            $searchDir = $parent
        }
    }

    if ($reactDir) {
        $runCmd = "npm start"
        if (Test-Path (Join-Path $reactDir "package.json")) {
            $pkgJson = Get-Content (Join-Path $reactDir "package.json") -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($pkgJson -and $pkgJson.scripts -and $pkgJson.scripts.dev -and -not $pkgJson.scripts.start) {
                $runCmd = "npm run dev"
            }
        }
        Log-Msg "Encontrado package.json en: $reactDir. Disparando $runCmd..."
        # Usamos un BAT dinamico para que Windows no tenga excusa
        $batPath = Join-Path $root "start_react_temp.bat"
        Set-Content -Path $batPath -Value "@echo off`r`ncd /d `"$reactDir`"`r`nset BROWSER=none`r`n$runCmd"
        
        return (Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$batPath`"" -WorkingDirectory $reactDir `
            -RedirectStandardOutput (Join-Path $root "react.log") -RedirectStandardError (Join-Path $root "react.err.log") `
            -WindowStyle Hidden -PassThru).Id
    } else {
        Log-Msg "Abortando React: No se encontro package.json en $contextPath ni en carpetas superiores."
    }
    return $null
}

function Start-ClaudeWatcher {
    $nodeExe = Join-Path $root "node.exe"
    if (-not (Test-Path $nodeExe)) { $nodeExe = "node" }
    return (Start-Process -FilePath $nodeExe -ArgumentList "watcher\watch-claude.js" -WorkingDirectory $root -WindowStyle Hidden -PassThru).Id
}

function Start-GeminiWatcher {
    $nodeExe = Join-Path $root "node.exe"
    if (-not (Test-Path $nodeExe)) { $nodeExe = "node" }
    return (Start-Process -FilePath $nodeExe -ArgumentList "watcher\watch-gemini.js" -WorkingDirectory $root -WindowStyle Hidden -PassThru).Id
}

function Start-Cloudflared {
    Log-Msg "Arrancando Cloudflared..."
    $errFile = Join-Path $root "cloudflared.err.log"
    Remove-Item $errFile -ErrorAction SilentlyContinue
    $cfPath = Join-Path $root "cloudflared.exe"
    
    $proc = Start-Process -FilePath $cfPath -ArgumentList "tunnel", "--url", "http://localhost:$Port" -WorkingDirectory $root `
        -RedirectStandardError $errFile -WindowStyle Hidden -PassThru
    return $proc.Id
}

$globalLastUrl = ""

function Update-CurrentUrl {
    $errFile = Join-Path $root "cloudflared.err.log"
    if (Test-Path $errFile) {
        $found = Select-String -Path $errFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -Last 1
        if ($found) {
            $url = $found.Matches[0].Value
            Set-Content -Path (Join-Path $root "current-url.txt") -Value $url -NoNewline
            
            if ($url -ne $globalLastUrl) {
                $globalLastUrl = $url
                Write-Host ""
                Write-Host "==========================================================" -ForegroundColor Green
                Write-Host "🚀 SISTEMA TOTALMENTE EN LINEA Y FUNCIONANDO" -ForegroundColor Green
                Write-Host "🌐 URL DE CLOUDFLARE: $url" -ForegroundColor Yellow
                Write-Host "==========================================================" -ForegroundColor Green
                Write-Host ""
            }
            return $url
        }
    }
    return $null
}

# LA ESCOBA: Mata procesos viejos
Log-Msg "Limpiando procesos viejos..."
Stop-Process -Name "VoiceAssistant_TFTE" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# ARRANCAMOS
Log-Msg "Verificando estado de sesión de Antigravity (IA)..."
Write-Host ">>> Si la sesión caducó, se abrirá el navegador en breve. <<<" -ForegroundColor Yellow

# Hacemos el ping en background para NO bloquear el arranque rápido (Fase 4 - Fix)
try {
    Start-Process -FilePath "agy" -ArgumentList "-p `"Ping del sistema`" --mode plan --output-format text --dangerously-skip-permissions" -WindowStyle Hidden
    Log-Msg "Ping asíncrono a la IA lanzado correctamente."
} catch {
    Log-Msg "Aviso: No se pudo verificar la sesión de IA."
}

$serverPid = Start-Server
$reactPid  = Start-ReactApp
$claudePid = Start-ClaudeWatcher
$geminiPid = Start-GeminiWatcher
$cfPid     = Start-Cloudflared

# BUCLE SUPERVISOR
while ($true) {
    Start-Sleep -Seconds $CHECK_INTERVAL_SEC

    if ((Test-Path (Join-Path $root "stop.txt")) -or (-not (Test-Path (Join-Path $root "AnywhereDesignServer.exe")))) {
        Log-Msg "Apagando sistema (stop.txt detectado o EXE borrado)..."
        Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue
        Stop-Process -Id $reactPid -Force -ErrorAction SilentlyContinue
        Stop-Process -Id $claudePid -Force -ErrorAction SilentlyContinue
        Stop-Process -Id $geminiPid -Force -ErrorAction SilentlyContinue
        Stop-Process -Id $cfPid -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $root "stop.txt") -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $root "start_react_temp.bat") -ErrorAction SilentlyContinue
        exit
    }

    Update-CurrentUrl | Out-Null

    if (-not (Test-Alive $serverPid)) { Log-Msg "Reviviendo servidor Node..."; $serverPid = Start-Server }
    if (-not (Test-Alive $reactPid))  { Log-Msg "Reviviendo React..."; $reactPid = Start-ReactApp }
    if (-not (Test-Alive $claudePid)) { $claudePid = Start-ClaudeWatcher }
    if (-not (Test-Alive $geminiPid)) { $geminiPid = Start-GeminiWatcher }
    
    if (-not (Test-Alive $cfPid)) { 
        Log-Msg "Reviviendo Cloudflared..."; 
        $cfPid = Start-Cloudflared 
    } else {
        # FASE 3.1: Validación activa del túnel
        if ($globalLastUrl -ne "") {
            try {
                $null = Invoke-WebRequest -Uri $globalLastUrl -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
            } catch {
                $statusCode = 0
                if ($_.Exception.Response) {
                    $statusCode = $_.Exception.Response.StatusCode.value__
                }
                # Fallos críticos de Cloudflare o timeout total sin respuesta HTTP
                if ($statusCode -eq 0 -or $statusCode -eq 502 -or $statusCode -eq 530 -or $statusCode -eq 522) {
                    Log-Msg "WARNING: Túnel Cloudflare no responde (Código: $statusCode). Reiniciando..."
                    Stop-Process -Id $cfPid -Force -ErrorAction SilentlyContinue
                    $cfPid = Start-Cloudflared
                    $globalLastUrl = ""
                }
            }
        }
    }
}