@echo off
setlocal

REM Run this .bat from the same folder as your .NET project file (.csproj)
cd /d "%~dp0"

echo Restoring .NET packages...
dotnet restore

if errorlevel 1 (
    echo.
    echo dotnet restore failed. Fix the error above and try again.
    pause
    exit /b 1
)

echo.
echo Starting the .NET web application...
start "PMT - dotnet run" cmd /k "cd /d ""%~dp0"" && dotnet run"

echo.
echo Waiting a few seconds for the web server to start...
timeout /t 5 /nobreak >nul

echo Opening Chrome at http://localhost:5056 ...
start "" chrome "http://localhost:5056"

if errorlevel 1 (
    echo Chrome was not found through the normal launcher path.
    echo Trying the default Chrome install location...
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:5056"
)

endlocal
