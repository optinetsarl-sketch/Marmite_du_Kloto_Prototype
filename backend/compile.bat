@echo off
setlocal enabledelayedexpansion

set "BACKEND=%~dp0"
if "%BACKEND:~-1%"=="\" set "BACKEND=%BACKEND:~0,-1%"
for %%I in ("%BACKEND%\..") do set "PROJECT=%%~fI"

if exist "%PROJECT%\.venv\Scripts\python.exe" (
    set "VENV=%PROJECT%\.venv"
) else (
    set "VENV=python"
)

cd /d "%BACKEND%"

echo.
echo ================================================
echo   La Marmite du Kloto - Compilation PyInstaller
echo ================================================
echo.

echo [1/3] Nettoyage des builds precedents...
if exist "%BACKEND%\build\Marmite-du-Kloto" rd /s /q "%BACKEND%\build\Marmite-du-Kloto"
if exist "%BACKEND%\dist\Marmite-du-Kloto" rd /s /q "%BACKEND%\dist\Marmite-du-Kloto"

echo [2/3] Verification de waitress...
"%VENV%\Scripts\python.exe" -c "import waitress" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo     Installation de waitress...
    "%VENV%\Scripts\pip.exe" install waitress
)

echo [3/3] Verification de PyInstaller...
"%VENV%\Scripts\python.exe" -m PyInstaller --version 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo     Installation de PyInstaller...
    "%VENV%\Scripts\pip.exe" install pyinstaller
)

echo.
echo Lancement de PyInstaller...
echo Command: %VENV%\Scripts\python.exe -m PyInstaller marmite-kloto.spec --noconfirm --clean
echo.

"%VENV%\Scripts\python.exe" -m PyInstaller marmite-kloto.spec --noconfirm --clean

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo   SUCCESS: Compilation terminee !
    echo ================================================
    dir /s dist\Marmite-du-Kloto\Marmite-du-Kloto.exe 2>nul || echo WARNING: .exe introuvable
) else (
    echo.
    echo ================================================
    echo   ERREUR: Compilation echouee (code %ERRORLEVEL%)
    echo ================================================
)
