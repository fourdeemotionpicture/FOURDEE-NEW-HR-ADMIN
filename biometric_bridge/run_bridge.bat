@echo off
title eSSL Biometric Bridge Sync
cd /d "%~dp0"
echo Starting Biometric Bridge...
python bridge.py
pause
