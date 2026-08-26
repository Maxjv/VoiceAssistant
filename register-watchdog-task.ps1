# Registra la tarea programada que levanta el watchdog del TFTE Voice
# Assistant al iniciar sesion (local o por Escritorio Remoto de Chrome).
# Correr UNA VEZ desde una PowerShell como Administrador:
#   & "C:\TFTE\VoiceAssistant\register-watchdog-task.ps1"

$ErrorActionPreference = "Stop"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\TFTE\VoiceAssistant\watchdog.ps1"' `
    -WorkingDirectory "C:\TFTE\VoiceAssistant"

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName "TFTE-VoiceAssistant-Watchdog" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Levanta server, cloudflared y watchers del TFTE Voice Assistant al iniciar sesion" `
    -Force

Write-Host ""
Write-Host "Listo. Tarea registrada:" -ForegroundColor Green
Get-ScheduledTask -TaskName "TFTE-VoiceAssistant-Watchdog" | Select-Object TaskName, State
Write-Host ""
Write-Host "Podes cerrar esta ventana." -ForegroundColor Green
