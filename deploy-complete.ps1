# deploy-complete.ps1 - Deploiement silencieux La Marmite du Kloto (zero fenetre console)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$rootDir = $PSScriptRoot
$distDir = Join-Path $rootDir "backend\dist\Marmite-du-Kloto"
$deployDir = Join-Path $rootDir "deployment_client"
$exeName = "Marmite-du-Kloto.exe"
$exePath = Join-Path $deployDir $exeName
$appName = "Marmite du Kloto"

Write-Host "`n[+] Deploiement $appName - Mode Silencieux" -ForegroundColor Cyan
Write-Host "    Dossier projet : $rootDir" -ForegroundColor Gray
Write-Host "    Destination    : $deployDir`n" -ForegroundColor Gray

# Verification du build
if (-not (Test-Path $distDir)) {
    Write-Host "[!] ERREUR : Dossier de build introuvable" -ForegroundColor Red
    Write-Host "    Executez d'abord :" -ForegroundColor Yellow
    Write-Host "      1. cd frontend && npm run build" -ForegroundColor Yellow
    Write-Host "      2. cd backend && .\compile.bat" -ForegroundColor Yellow
    exit 1
}

# Nettoyage et recopie
if (Test-Path $deployDir) {
    Remove-Item $deployDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -Path $deployDir -ItemType Directory -Force | Out-Null
robocopy $distDir $deployDir /E /NFL /NDL /NJH /NJS | Out-Null

# Verifications critiques
if (-not (Test-Path $exePath)) {
    Write-Host "[X] ECHEC : $exeName introuvable" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $deployDir "_internal"))) {
    Write-Host "[X] ECHEC : dossier '_internal' manquant" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Structure copiee`n" -ForegroundColor Green

# Copie du fichier .env (contient MONGO_URL + MONGO_URL_ATLAS pour la sync)
$envSource = Join-Path $rootDir "backend\.env"
$envDest   = Join-Path $deployDir ".env"
if (Test-Path $envSource) {
    Copy-Item $envSource $envDest -Force
    Write-Host "[OK] .env copie (sync Local <-> Atlas incluse)`n" -ForegroundColor Green
} else {
    Write-Host "[!] AVERTISSEMENT : backend\.env introuvable - sync Atlas inactive`n" -ForegroundColor Yellow
}

# Copie du logo et de l'icone app.ico
$logoSource = Join-Path $rootDir "LOGO-Marmite_du_Kloto.jpg"
$logoDest   = Join-Path $deployDir "LOGO-Marmite_du_Kloto.jpg"
if (Test-Path $logoSource) { Copy-Item $logoSource $logoDest -Force }

$icoSource  = Join-Path $rootDir "app.ico"
$icoDest    = Join-Path $deployDir "app.ico"
if (Test-Path $icoSource) { Copy-Item $icoSource $icoDest -Force }
$iconTarget = if (Test-Path $icoDest) { "$icoDest,0" } else { "$exePath,0" }

# === CREATION DES LANCEURS VBS (ZERO FENETRE) ===

# Lanceur Bureau : demarre en arriere-plan et ouvre le navigateur apres 4s
$vbsDesktop = @'
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
exePath = objFSO.BuildPath(objFSO.GetParentFolderName(WScript.ScriptFullName), "Marmite-du-Kloto.exe")
objShell.Run """" & exePath & """", 0, False
WScript.Sleep 4000
objShell.Run "http://localhost:8050", 1, False
WScript.Quit
'@
Set-Content -Path (Join-Path $deployDir "Lancer Marmite du Kloto.vbs") -Value $vbsDesktop -Encoding ASCII -Force

# Lanceur Silencieux : demarre en arriere-plan et ouvre egalement le navigateur apres 4s
$vbsStartup = @'
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
exePath = objFSO.BuildPath(objFSO.GetParentFolderName(WScript.ScriptFullName), "Marmite-du-Kloto.exe")
objShell.Run """" & exePath & """", 0, False
WScript.Sleep 4000
objShell.Run "http://localhost:8050", 1, False
WScript.Quit
'@
Set-Content -Path (Join-Path $deployDir "Lancer Silencieux.vbs") -Value $vbsStartup -Encoding ASCII -Force

Write-Host "[OK] Lanceurs VBS crees (zero fenetre console)`n" -ForegroundColor Green

# === RACCOURCI BUREAU ===
$WshShell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "Marmite du Kloto.lnk"

if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force -ErrorAction SilentlyContinue }
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = $deployDir
$shortcut.IconLocation = $iconTarget
$shortcut.Description = "La Marmite du Kloto - Bar-Resto - Gestion"
$shortcut.Save()
Write-Host "[OK] Raccourci Bureau avec icone app.ico : $shortcutPath`n" -ForegroundColor Green

# === RACCOURCI STARTUP (DEMARRAGE AUTO) ===
$startupFolder = [Environment]::GetFolderPath('Startup')
$startupShortcut = Join-Path $startupFolder "Marmite du Kloto.lnk"

if (Test-Path $startupShortcut) { Remove-Item $startupShortcut -Force -ErrorAction SilentlyContinue }
$shortcut2 = $WshShell.CreateShortcut($startupShortcut)
$shortcut2.TargetPath = $exePath
$shortcut2.WorkingDirectory = $deployDir
$shortcut2.IconLocation = $iconTarget
$shortcut2.Description = "La Marmite du Kloto - Demarrage automatique au boot Windows"
$shortcut2.Save()
Write-Host "[OK] Raccourci Startup avec icone app.ico : $startupShortcut`n" -ForegroundColor Green

# Copie du dossier FACTURE
$factureSource = Join-Path $rootDir "FACTURE"
$factureDest   = Join-Path $deployDir "FACTURE"
if (Test-Path $factureSource) {
    Copy-Item $factureSource $factureDest -Recurse -Force
    Write-Host "[OK] Dossier FACTURE copie dans le deploiement`n" -ForegroundColor Green
}

# Copie du dossier DOCUMENTATION
$docSource = Join-Path $rootDir "DOCUMENTATION"
$docDest   = Join-Path $deployDir "DOCUMENTATION"
if (Test-Path $docSource) {
    Copy-Item $docSource $docDest -Recurse -Force
    Write-Host "[OK] Dossier DOCUMENTATION (PowerPoint & Word) copie dans le deploiement`n" -ForegroundColor Green
}

# === CREATION DE L'ARCHIVE ZIP FINALE DE DEPLOIEMENT ===
$zipPathRoot = Join-Path $rootDir "Marmite_du_Kloto_Deploiement_Final.zip"
$optinetFolder = "C:\Users\abrah\OneDrive\Documents\demande d emploie en ligne\Optinet+SARLU"
$zipPathOptinet = Join-Path $optinetFolder "Marmite_du_Kloto_Deploiement_Final.zip"

if (Test-Path $zipPathRoot) { Remove-Item $zipPathRoot -Force -ErrorAction SilentlyContinue }

Write-Host "[+] Generation de l'archive ZIP finale de deploiement en cours..." -ForegroundColor Cyan
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipPathRoot -CompressionLevel Optimal -Force

if (Test-Path $optinetFolder) {
    if (Test-Path $zipPathOptinet) { Remove-Item $zipPathOptinet -Force -ErrorAction SilentlyContinue }
    Copy-Item $zipPathRoot $zipPathOptinet -Force
}

Write-Host "[OK] Archive ZIP creee avec succes :" -ForegroundColor Green
Write-Host "     -> $zipPathRoot`n" -ForegroundColor White

# === MESSAGE FINAL ===
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOIEMENT SILENCIEUX TERMINE !" -ForegroundColor Green
Write-Host "  La Marmite du Kloto - Bar-Resto" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n[+] UTILISATION :" -ForegroundColor Cyan
Write-Host "    -> Double-cliquez sur 'Marmite du Kloto' sur le Bureau" -ForegroundColor White
Write-Host "       (aucune fenetre ne s'ouvre - le navigateur s'ouvre apres 4s)" -ForegroundColor Gray
Write-Host "`n[+] DEMARRAGE AUTO :" -ForegroundColor Cyan
Write-Host "    -> L'application demarre SILENCIEUSEMENT au boot de Windows" -ForegroundColor White
Write-Host "    -> Acces manuel : http://localhost:8050" -ForegroundColor Gray
Write-Host "`n[+] BASE DE DONNEES :" -ForegroundColor Cyan
Write-Host "    -> MongoDB Local (prioritaire) avec basculement automatique vers Atlas" -ForegroundColor White
Write-Host "    -> Synchronisation : python manage.py sync_atlas --loop" -ForegroundColor Gray
Write-Host "`n[!] ARCHIVE COMPLETED :" -ForegroundColor Yellow
Write-Host "    -> Marmite_du_Kloto_Deploiement_Final.zip est prête !" -ForegroundColor White
Write-Host "`n"
