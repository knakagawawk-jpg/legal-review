@echo off
echo FastAPIサーバーとStreamlitアプリを起動します...

cd /d "%~dp0"

echo.
echo FastAPIサーバーを起動中...
start "FastAPI Server" cmd /k "python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo Streamlitアプリを起動中...
start "Streamlit App" cmd /k "python -m streamlit run web.py"

echo.
echo 両方のサーバーが起動しました。
echo FastAPIサーバー: http://127.0.0.1:8000
echo Streamlitアプリ: http://localhost:8501
echo.
echo サーバーを停止するには、それぞれのウィンドウを閉じてください。
pause
