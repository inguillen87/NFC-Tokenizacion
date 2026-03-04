@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0nfc_keys.ps1" -ClientSlug %1 -BatchId %2
