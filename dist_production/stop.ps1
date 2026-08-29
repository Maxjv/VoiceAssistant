# Apaga TODO el TFTE Voice Assistant: el watchdog (si esta corriendo), el
# servidor, el tunel de Cloudflare/ngrok y los 2 watchers de Modo Agente.
# Uso: .\stop.ps1

$root = $PSScriptRoot

Write-Host "Buscando procesos del watchdog..." -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'watchdog\.ps1' } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "Detenido watchdog (PID $($_.ProcessId))" -ForegroundColor Cyan
    }

Write-Host "Apagando servidor, watchers, ngrok y cloudflared..." -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match [regex]::Escape($root) -or $_.CommandLine -match 'cloudflared' } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "Detenido $($_.ProcessId): $($_.CommandLine.Substring(0, [Math]::Min(80, $_.CommandLine.Length)))" -ForegroundColor DarkGray
    }

Get-CimInstance Win32_Process -Filter "name='cmd.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'cloudflared' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$pidFile = Join-Path $root ".run-pids.json"
if (Test-Path $pidFile) {
    $pids = Get-Content $pidFile | ConvertFrom-Json
    foreach ($p in @($pids.serverPid, $pids.ngrokPid, $pids.claudeWatcherPid, $pids.geminiWatcherPid)) {
        if ($null -ne $p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item $pidFile -Force
}

Write-Host "Todo apagado." -ForegroundColor Green
