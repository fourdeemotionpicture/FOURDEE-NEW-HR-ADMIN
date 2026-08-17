@echo off
title eSSL Biometric Debug Log Dumper
cd /d "%~dp0"
echo Running eSSL Punch Dumper...
python debug_punches.py
pause
