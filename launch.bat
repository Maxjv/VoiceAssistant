@echo off
cd /d "%~dp0"
start "" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -WindowStyle Hidden -ExecutionPolicy Bypass -File .\launcher.ps1
