Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c ""set CLOUD_URL=https://instant-print.onrender.com && npm run agent --prefix server""", 0, False
