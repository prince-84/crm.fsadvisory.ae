@echo off
title FS Advisory CRM - WhatsApp Gateway Daemon (Port 5003)
cd /d "%~dp0whatsapp-gateway"
echo ======================================================================
echo   FS ADVISORY CRM - WHATSAPP GATEWAY v2.0
echo   Running Puppeteer WhatsApp Web on http://127.0.0.1:5003
echo   Synchronizing authentic QR codes to Laravel backend...
echo ======================================================================
echo.
node server.js
pause
