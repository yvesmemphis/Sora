param(
    [string]$TaskName = "RestaurantStockAlerts",
    [string]$DailyAt = "07:00"
)

$BackendPath = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $BackendPath ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonPath)) {
    throw "Python virtualenv not found: $PythonPath"
}

$Action = New-ScheduledTaskAction `
    -Execute $PythonPath `
    -Argument "manage.py check_stock_alerts" `
    -WorkingDirectory $BackendPath
$Trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Vérifie quotidiennement les alertes de stock du restaurant." `
    -Force | Out-Null

Write-Output "Scheduled task '$TaskName' registered for $DailyAt."
