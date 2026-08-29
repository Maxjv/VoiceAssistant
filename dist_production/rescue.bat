@echo off
title Rescate TFTE Assistant
echo Iniciando proceso de rescate...
powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0rescue.ps1"
exit
