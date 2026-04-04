@echo off
setlocal

set "DB_NAME=careerops"
set "DB_USER=root"
set "DB_PASSWORD=27@67Hampden"
set "BACKUP_DIR=C:\Users\BRLew\OneDrive\data\careerops_backups"
set "MYSQLDUMP_EXE=C:\Program Files\MySQL\MySQL Server 9.6\bin\mysqldump.exe"

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

if not exist "%MYSQLDUMP_EXE%" (
    echo ERROR: mysqldump not found here:
    echo %MYSQLDUMP_EXE%
    pause
    exit /b 1
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "TS=%%i"

set "BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_%TS%.sql"

echo Creating backup...
echo Database   : %DB_NAME%
echo Output File: %BACKUP_FILE%
echo.

"%MYSQLDUMP_EXE%" --single-transaction --set-gtid-purged=OFF -u"%DB_USER%" -p"%DB_PASSWORD%" "%DB_NAME%" > "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Backup created successfully:
    echo %BACKUP_FILE%
) else (
    echo.
    echo Backup failed.
    exit /b 1
)

endlocal
pause