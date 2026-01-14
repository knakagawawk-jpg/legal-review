@echo off
echo FastAPIサーバーとNext.jsアプリを起動します...

cd /d "%~dp0"

echo.
echo FastAPIサーバーを起動中...
start "FastAPI Server" cmd /k "python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo Next.jsアプリを起動中...
cd web_next
start "Next.js App" cmd /k "npm run dev"
cd ..

echo.
echo 両方のサーバーが起動しました。
echo FastAPIサーバー: http://127.0.0.1:8000
echo Next.jsアプリ: http://localhost:3000
echo.
echo サーバーを停止するには、それぞれのウィンドウを閉じてください。
pause
