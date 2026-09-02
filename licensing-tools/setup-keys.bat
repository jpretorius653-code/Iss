@echo off
setlocal
REM ============================================================
REM  ISS Weighbridge - First-Time Key Setup
REM
REM  Run this ONCE, EVER. It creates your signing key and prints the
REM  public key to paste into license.js.
REM
REM  Running it again will NOT overwrite an existing key (the script
REM  refuses) - so you can't destroy licences you've already issued by
REM  double-clicking this a second time by mistake.
REM ============================================================

cd /d "%~dp0"

echo(
echo  ============================================
echo    ISS Weighbridge  -  First-Time Key Setup
echo  ============================================
echo(

where node >nul 2>nul
if errorlevel 1 (
  echo  ERROR: Node.js is not installed, or not on the PATH.
  echo  Install the LTS version from https://nodejs.org and try again.
  echo(
  pause
  exit /b 1
)

if exist "iss-private.pem" (
  echo  A signing key already exists in this folder ^(iss-private.pem^).
  echo(
  echo  You have already done this step. Do NOT generate a new key -
  echo  it would invalidate every licence you have issued.
  echo(
  echo  If you genuinely need to start over, move the existing key
  echo  somewhere safe first, then run this again.
  echo(
  pause
  exit /b 1
)

node iss-genkeys.js

echo(
echo  ============================================
echo   NEXT STEPS - do these now:
echo  ============================================
echo   1. Copy the PUBLIC KEY block printed above.
echo   2. Open ..\electron\license.js and replace the line
echo        REPLACE_WITH_YOUR_PUBLIC_KEY
echo      with it ^(keep the BEGIN/END lines^).
echo   3. In ..\electron\license.js, change FP_SALT to your own phrase.
echo   4. BACK UP iss-private.pem twice, offline. Never put it
echo      in the repo, the installer, or on a customer PC.
echo  ============================================
echo(
pause
endlocal
