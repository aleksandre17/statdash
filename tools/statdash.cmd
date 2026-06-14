@echo off
REM CMD.exe entry — forwards to statdash.ps1 via PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0statdash.ps1" %*
