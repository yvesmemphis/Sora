param(
    [string]$TaskName = "RestaurantDailyForecasts",
    [string]$DailyAt = "04:00"
)

$BackendPath = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $BackendPath ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonPath)) {
    throw "Python virtualenv not found: $PythonPath"
}

$Action = New-ScheduledTaskAction `
    -Execute $PythonPath `
    -Argument "manage.py generate_forecasts" `
    -WorkingDirectory $BackendPath
$Trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Génère les prévisions de ventes quotidiennes du restaurant." `
    -Force | Out-Null

Write-Output "Scheduled task '$TaskName' registered for $DailyAt."
