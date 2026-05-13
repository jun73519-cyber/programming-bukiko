Option Explicit

' Next dev を「最小化のコンソール 1 枚」だけで起動する。
' この .vbs を直接ダブルクリックすると、cmd の黒画面は dev 用の 1 枚（最小化）だけになります。

Dim sh, fso, root, cmdLine
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))

Const wdMinimized = 2

cmdLine = "cmd /c cd /d """ & root & """ && npm run dev"
sh.Run cmdLine, wdMinimized, False
