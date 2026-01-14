# 環境変数ファイルの正しい設定方法

## ⚠️ よくある間違い

### ❌ 間違い: `.env/local` または `.env\local`
- `.env`という**ディレクトリ**を作成してしまう
- その中に`local`というファイルを作成してしまう

### ✅ 正しい: `.env.local`
- `.env.local`という**ファイル名**で作成
- ドット（`.`）で始まるファイル名

## 📋 正しいファイルパス

### バックエンド
```
law-review/.env
```
- ファイル名: `.env`
- 場所: `law-review`ディレクトリ直下

### フロントエンド
```
law-review/web_next/.env.local
```
- ファイル名: `.env.local`
- 場所: `web_next`ディレクトリ直下

## 🔧 正しい作成方法

### Windows PowerShellの場合

```powershell
# フロントエンドの.env.localファイルを作成
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review\web_next
New-Item -Path ".env.local" -ItemType File -Force
```

### 手動で作成する場合

1. `law-review/web_next`ディレクトリに移動
2. 新しいファイルを作成
3. ファイル名を **`.env.local`** にする（ドットで始まる）
   - Windowsのエクスプローラーでは「名前を付けて保存」で `.env.local` と入力

## 📝 ファイル内容

### `law-review/web_next/.env.local`

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=あなたの実際のクライアントID.apps.googleusercontent.com
BACKEND_INTERNAL_URL=http://localhost:8000
```

## ✅ 確認方法

```powershell
# 正しいファイルが存在するか確認
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review\web_next
Get-ChildItem -Force | Where-Object { $_.Name -like ".env*" }
```

正しく作成されていれば、`.env.local`というファイルが表示されます。
