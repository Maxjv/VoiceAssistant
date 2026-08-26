# Prende el servidor de TFTE Voice Assistant + el túnel fijo de ngrok.
# Uso: click derecho > "Ejecutar con PowerShell", o desde una terminal: .\start.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

# --- CONFIG: pegá acá tu dominio fijo de ngrok (dashboard.ngrok.com/domains) ---
$NgrokDomain = "identical-swarm-collector.ngrok-free.dev"
# El acceso directo de WinGet (\Links\ngrok.exe) se rompió al actualizar ngrok
# manualmente el 2026-08-11; el binario real quedó en la carpeta del paquete.
$NgrokExe = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
$Port = 4000

$pidFile = Join-Path $root ".run-pids.json"

if (Test-Path $pidFile) {
    Write-Host "Ya parece haber un proceso corriendo. Ejecutá .\stop.ps1 primero si querés reiniciar." -ForegroundColor Yellow
    $existing = Get-Content $pidFile | ConvertFrom-Json
    $serverAlive = Get-Process -Id $existing.serverPid -ErrorAction SilentlyContinue
    $ngrokAlive = Get-Process -Id $existing.ngrokPid -ErrorAction SilentlyContinue
    $claudeWatcherAlive = Get-Process -Id $existing.claudeWatcherPid -ErrorAction SilentlyContinue
    $geminiWatcherAlive = Get-Process -Id $existing.geminiWatcherPid -ErrorAction SilentlyContinue
    if ($serverAlive -and $ngrokAlive -and $claudeWatcherAlive -and $geminiWatcherAlive) {
        Write-Host "Todo sigue activo en: https://$NgrokDomain" -ForegroundColor Green
        exit 0
    }
}

Write-Host "Iniciando servidor Node (puerto $Port)..." -ForegroundColor Cyan
$serverProc = Start-Process -FilePath "node" -ArgumentList "server.js" `
    -WorkingDirectory $root `
    -RedirectStandardOutput (Join-Path $root "server.log") `
    -RedirectStandardError (Join-Path $root "server.err.log") `
    -WindowStyle Hidden -PassThru

Start-Sleep -Seconds 2

Write-Host "Iniciando watchers de Modo Agente (Claude + Gemini)..." -ForegroundColor Cyan
$claudeWatcherProc = Start-Process -FilePath "node" -ArgumentList "watcher\watch-claude.js" `
    -WorkingDirectory $root `
    -RedirectStandardOutput (Join-Path $root "watcher\claude.log") `
    -RedirectStandardError (Join-Path $root "watcher\claude.err.log") `
    -WindowStyle Hidden -PassThru
$geminiWatcherProc = Start-Process -FilePath "node" -ArgumentList "watcher\watch-gemini.js" `
    -WorkingDirectory $root `
    -RedirectStandardOutput (Join-Path $root "watcher\gemini.log") `
    -RedirectStandardError (Join-Path $root "watcher\gemini.err.log") `
    -WindowStyle Hidden -PassThru

if ($NgrokDomain -like "PENDIENTE*") {
    Write-Host "Falta configurar tu dominio fijo de ngrok en start.ps1 (variable `$NgrokDomain)." -ForegroundColor Red
    Write-Host "El servidor local ya está arriba en http://localhost:$Port" -ForegroundColor Yellow
    @{ serverPid = $serverProc.Id; ngrokPid = $null; claudeWatcherPid = $claudeWatcherProc.Id; geminiWatcherPid = $geminiWatcherProc.Id } | ConvertTo-Json | Set-Content $pidFile
    exit 0
}

Write-Host "Levantando túnel cloudflared..." -ForegroundColor Cyan
$ngrokProc = Start-Process -FilePath "node" -ArgumentList "start_tunnel.js" `
    -WorkingDirectory $root `
    -RedirectStandardOutput (Join-Path $root "ngrok.log") `
    -RedirectStandardError (Join-Path $root "ngrok.err.log") `
    -WindowStyle Hidden -PassThru

@{ serverPid = $serverProc.Id; ngrokPid = $ngrokProc.Id; claudeWatcherPid = $claudeWatcherProc.Id; geminiWatcherPid = $geminiWatcherProc.Id } | ConvertTo-Json | Set-Content $pidFile

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "Listo. Link fijo (siempre el mismo):" -ForegroundColor Green
Write-Host "  https://$NgrokDomain" -ForegroundColor Green
Write-Host ""
Write-Host "Modo Agente (botón robot) activo: Claude y Gemini escuchando." -ForegroundColor Green
Write-Host "Para apagar todo: .\stop.ps1" -ForegroundColor DarkGray
