# Google 認証のポート設定について

## 🔍 ポートの確認方法

Next.js アプリがどのポートで動いているか確認してください：

### 通常の開発環境（`npm run dev`）

```bash
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review\web_next
npm run dev
```

**デフォルトポート:** `http://localhost:3000`

### Docker Compose 使用時

```bash
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
docker compose --profile local up
```

**ポート:** `http://localhost:8080`

## 🎯 Google Cloud Console の設定

使用しているポートに合わせて、Google Cloud Console で以下を設定してください：

### 1. OAuth 2.0 クライアント ID の設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 「API とサービス」→「認証情報」を選択
3. 作成した OAuth 2.0 クライアント ID をクリック
4. **「承認済みの JavaScript 生成元」**に以下を追加：
   - 通常の開発環境: `http://localhost:3000`
   - Docker Compose 使用時: `http://localhost:8080`
5. **「承認済みのリダイレクト URI」**に同じポートを追加：
   - 通常の開発環境: `http://localhost:3000`
   - Docker Compose 使用時: `http://localhost:8080`
6. **「保存」**をクリック

### 2. 両方のポートを追加する場合

両方の環境で使用する場合は、両方のポートを追加できます：

- `http://localhost:3000`
- `http://localhost:8080`

## 📋 確認チェックリスト

- [ ] 実際に使用しているポートを確認した
- [ ] Google Cloud Console で「承認済みの JavaScript 生成元」に正しいポートを追加した
- [ ] Google Cloud Console で「承認済みのリダイレクト URI」に正しいポートを追加した
- [ ] ブラウザのキャッシュをクリアした（Ctrl+Shift+R）
- [ ] 再度ログインを試した

## 💡 トラブルシューティング

### ポートがわからない場合

ブラウザのアドレスバーを確認してください：

- `http://localhost:3000` → ポート 3000 を使用
- `http://localhost:8080` → ポート 8080 を使用

### エラーが続く場合

1. Google Cloud Console で設定を確認
2. ブラウザのコンソール（F12）でエラーを確認
3. サーバーを再起動
4. ブラウザのキャッシュをクリア

## 📝 まとめ

**重要:** Google Cloud Console の設定は、実際に使用しているポートと一致している必要があります。

- 通常の開発環境: `http://localhost:3000`
- Docker Compose 使用時: `http://localhost:8080`

どちらを使用しているか確認して、Google Cloud Console の設定を更新してください。
