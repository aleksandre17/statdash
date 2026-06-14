@echo off
:: deploy  —  All deployment modes
:: Usage: deploy.bat <local|dist|remote|sync>
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0deploy.ps1" %*