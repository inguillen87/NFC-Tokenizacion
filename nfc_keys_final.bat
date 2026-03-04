@echo off
if "%~1"=="" (
  echo Usage: nfc_keys_final.bat BATCH_ID
  exit /b 1
)
powershell -ExecutionPolicy Bypass -File "%~dp0nfc_keys_final.ps1" -BatchId "%~1"
