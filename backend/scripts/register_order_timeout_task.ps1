param(
    [string]$TaskName = "RestaurantOrderTimeouts",
    [int]$EveryMinutes = 1
)

if ($EveryMinutes -lt 1) {
    throw "EveryMinutes must be at least 1."
}

$BackendPath = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $BackendPath ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonPath)) {
    throw "Python virtualenv not found: $PythonPath"
}

$Action = New-ScheduledTaskAction `
    -Execute $PythonPath `
    -Argument "manage.py process_public_order_timeouts" `
    -WorkingDirectory $BackendPath
$Trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Confirme les commandes publiques après leur délai de désistement." `
    -Force | Out-Null

Write-Output "Scheduled task '$TaskName' registered every $EveryMinutes minute(s)."
