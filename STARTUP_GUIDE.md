# 起動ガイド

## 1. 短答式問題データのインポート（初回のみ）

短答式問題を使用する前に、JSONファイルからデータベースにインポートする必要があります。

```powershell
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe import_short_answer_json_to_db.py json_data\予備試験\R7\R7_予備_短答_*.json
```

または、個別にインポート：

```powershell
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe import_short_answer_json_to_db.py json_data\予備試験\R7\R7_予備_短答_憲法.json
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe import_short_answer_json_to_db.py json_data\予備試験\R7\R7_予備_短答_行政法.json
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe import_short_answer_json_to_db.py json_data\予備試験\R7\R7_予備_短答_刑法.json
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe import_short_answer_json_to_db.py json_data\予備試験\R7\R7_予備_短答_刑事訴訟法.json
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe import_short_answer_json_to_db.py json_data\予備試験\R7\R7_予備_短答_民法.json
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe import_short_answer_json_to_db.py json_data\予備試験\R7\R7_予備_短答_商法.json
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe import_short_answer_json_to_db.py json_data\予備試験\R7\R7_予備_短答_民事訴訟法.json
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe import_short_answer_json_to_db.py json_data\予備試験\R7\R7_予備_短答_一般教養科目.json
```

## 2. サーバーの起動

### ステップ1: FastAPIサーバー（バックエンド）を起動

**ターミナル1（PowerShell）:**

```powershell
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

または、より簡単に：

```powershell
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
uvicorn app.main:app --reload
```

サーバーが起動すると、以下のメッセージが表示されます：
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### ステップ2: Streamlitアプリ（フロントエンド）を起動

**ターミナル2（新しいPowerShellウィンドウ）:**

```powershell
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
C:\Users\tvxqt\AppData\Local\Programs\Python\Python312\python.exe -m streamlit run web.py
```

または、より簡単に：

```powershell
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
streamlit run web.py
```

アプリが起動すると、ブラウザが自動的に開き、以下のURLでアクセスできます：
```
http://localhost:8501
```

## 3. アクセス

- **Streamlitアプリ**: http://localhost:8501
- **FastAPI API**: http://localhost:8000
- **API ドキュメント**: http://localhost:8000/docs

## 4. 使用方法

1. ブラウザで http://localhost:8501 を開く
2. サイドバーから「短答式試験」を選択
3. 試験種別、年度、科目を選択（またはランダムモードを選択）
4. 「🚀 開始」ボタンをクリック
5. 問題を解いて、「📊 回答を見る」ボタンで正誤を確認

## 5. 停止方法

各ターミナルで `Ctrl + C` を押してサーバーを停止します。
