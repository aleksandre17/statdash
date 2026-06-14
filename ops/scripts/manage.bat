@echo off
:: manage  —  Container lifecycle management
:: Usage: manage.bat <status|logs|restart|undeploy|delete>
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0manage.ps1" %*