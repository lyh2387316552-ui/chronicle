@echo off
rem Portable launcher: creates a desktop shortcut that auto-adapts to the current
rem extraction location, then opens the page. Works after moving/zipping the folder.
rem The Chinese shortcut name is built from char codes to avoid codepage issues.

set "ROOT=%~dp0"
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "$n=-join([char]0x53E4,[char]0x8352,[char]0x5927,[char]0x9646,[char]0x7F16,[char]0x5E74,[char]0x53F2);$w=New-Object -ComObject WScript.Shell;$d=[Environment]::GetFolderPath('Desktop');$l=$w.CreateShortcut($d+'\'+$n+'.lnk');$l.TargetPath='%ROOT%index.html';$l.WorkingDirectory='%ROOT%';$l.IconLocation='%ROOT%assets\logo.ico,0';$l.Description=$n;$l.Save()"

start "" "%ROOT%index.html"
