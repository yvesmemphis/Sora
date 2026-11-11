$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
    throw "Définissez DATABASE_URL avant la sauvegarde."
}
if (-not $env:BACKUP_DIR) {
    throw "Définissez BACKUP_DIR vers un dossier de sauvegarde."
}

$pgDump = if ($env:PG_DUMP_PATH) { $env:PG_DUMP_PATH } else { "pg_dump" }
if (-not (Get-Command $pgDump -ErrorAction SilentlyContinue)) {
    throw "pg_dump est introuvable. Définissez PG_DUMP_PATH si nécessaire."
}

New-Item -ItemType Directory -Path $env:BACKUP_DIR -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpPath = Join-Path $env:BACKUP_DIR "restaurant_$stamp.dump"
& $pgDump --dbname=$env:DATABASE_URL --format=custom --file=$dumpPath
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump a échoué avec le code $LASTEXITCODE."
}

$mediaPath = Join-Path $PSScriptRoot "..\media"
if (Test-Path $mediaPath) {
    Compress-Archive -Path $mediaPath -DestinationPath "$dumpPath.media.zip"
}

Write-Output "Sauvegarde terminée : $dumpPath"