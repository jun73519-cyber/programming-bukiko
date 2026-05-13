@echo off
REM Desktop launcher: call this .bat OR double-click 武器庫を起動.vbs directly (fewer black flashes).
REM This file only starts wscript and exits; it avoids keeping a parent console open for npm.
wscript //nologo "%~dp0武器庫を起動.vbs"
