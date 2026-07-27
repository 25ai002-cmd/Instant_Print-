$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$ShortcutPath = Join-Path $StartupFolder "PrintATM_Kiosk_Agent.lnk"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "c:\Users\301461\Desktop\Blackout club\printatm\start-kiosk-agent.vbs"
$Shortcut.WorkingDirectory = "c:\Users\301461\Desktop\Blackout club\printatm"
$Shortcut.Description = "PrintATM Cloud Kiosk Hardware Agent (Auto-starts on Windows boot)"
$Shortcut.Save()

Write-Host "AUTOSTART_INSTALLED_SUCCESSFULLY: $ShortcutPath"
