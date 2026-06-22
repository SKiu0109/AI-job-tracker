Set Shell = CreateObject("WScript.Shell")
Set FileSystem = CreateObject("Scripting.FileSystemObject")

ProjectRoot = FileSystem.GetParentFolderName(WScript.ScriptFullName)
PowerShellScript = ProjectRoot & "\scripts\stop-local-app.ps1"
Command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & PowerShellScript & """"

Shell.Run Command, 0, False
