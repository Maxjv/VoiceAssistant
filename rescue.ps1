# Script de Rescate - TFTE Assistant
# Fuerza el cierre de todos los procesos críticos y reinicia el sistema

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Iniciando Rescate de TFTE Assistant..." -ForegroundColor Yellow

Stop-Process -Name "VoiceAssistant_TFTE" -Force 
Stop-Process -Name "cloudflared" -Force 
Stop-Process -Name "node" -Force 

Write-Host "Procesos limpiados. Reiniciando Watchdog..." -ForegroundColor Green

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }

$watchdog = Join-Path $root "watchdog.ps1"

if (Test-Path $watchdog) {
    # Lanzar el watchdog en una nueva ventana oculta
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchdog`"" -WindowStyle Hidden
    Write-Host "Watchdog reiniciado con exito. El sistema generará una nueva URL." -ForegroundColor Green
} else {
    Write-Host "Error: No se encontro watchdog.ps1 en $root" -ForegroundColor Red
}

Start-Sleep -Seconds 2
