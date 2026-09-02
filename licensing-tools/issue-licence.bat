@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM  ISS Weighbridge - Issue a Licence
REM
REM  Double-click this. It asks for the customer's Install ID / request
REM  and their company, then runs iss-keygen.js and drops a .isslic file
REM  in this folder for you to send back.
REM
REM  Keep this file in the SAME folder as iss-keygen.js and
REM  iss-private.pem (licensing\tools). Don't move it on its own.
REM ============================================================

cd /d "%~dp0"

echo(
echo  ============================================
echo    ISS Weighbridge  -  Issue a Licence
echo  ============================================
echo(

REM --- Node present? ---
where node >nul 2>nul
if errorlevel 1 (
  echo  ERROR: Node.js is not installed, or not on the PATH.
  echo  Install the LTS version from https://nodejs.org and try again.
  echo(
  pause
  exit /b 1
)

REM --- Private key present? ---
if not exist "iss-private.pem" (
  echo  ERROR: iss-private.pem is not in this folder.
  echo(
  echo  This is your signing key. Either you have not run
  echo  iss-genkeys.js yet, or the key is kept elsewhere.
  echo  Copy it into this folder to issue a licence, then remove it again.
  echo(
  pause
  exit /b 1
)

REM --- Collect the request ---
echo  Paste the customer's Install ID or request blob, then press Enter.
echo  (It looks like  ISS-4F2A-9C11-8E30  or a long line of characters.)
echo(
set "REQ="
set /p "REQ=  Install ID / request: "
if "!REQ!"=="" (
  echo(
  echo  Nothing entered. Cancelled.
  echo(
  pause
  exit /b 1
)

REM --- Company ---
echo(
set "COMPANY="
set /p "COMPANY=  Company name (e.g. Promnatic Scales): "
if "!COMPANY!"=="" (
  echo(
  echo  A company name is required. Cancelled.
  echo(
  pause
  exit /b 1
)

REM --- Site (optional) ---
echo(
set "SITE="
set /p "SITE=  Site name (optional, press Enter to skip): "

REM --- Expiry (optional) ---
echo(
echo  Expiry: press Enter for a PERPETUAL licence, or type a date
echo  like 2027-12-31 to make it expire (for an annual subscription).
set "EXPIRES="
set /p "EXPIRES=  Expires (optional): "

REM --- Build the command ---
set "CMD=node iss-keygen.js --req "!REQ!" --company "!COMPANY!""
if not "!SITE!"==""    set "CMD=!CMD! --site "!SITE!""
if not "!EXPIRES!"=="" set "CMD=!CMD! --expires "!EXPIRES!""

echo(
echo  --------------------------------------------
echo  Issuing licence for: !COMPANY!
echo  --------------------------------------------
echo(

call !CMD!
set "RESULT=%errorlevel%"

echo(
if "!RESULT!"=="0" (
  echo  --------------------------------------------
  echo  Done. The .isslic file is in this folder:
  echo    %~dp0
  echo  Send that file to the customer. It works on their PC only.
  echo  --------------------------------------------
) else (
  echo  Something went wrong - see the message above.
  echo  Common cause: the request blob was cut off when pasted.
  echo  Ask the customer to use "Save request to file" and send you
  echo  the .issreq file, then run this again and paste the FULL path
  echo  to that file instead.
)
echo(
pause
endlocal
