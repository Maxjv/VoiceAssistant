@echo off
cd /d "%~dp0"
powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0launcher.ps1"
