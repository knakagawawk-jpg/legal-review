# Claude API 導入ガイド

## 📋 概要

このシステムは既にClaude APIを使用する準備が整っています。以下の手順でAPIキーを設定すれば、すぐに使用できます。

## 🔑 ステップ1: Anthropicアカウントの作成

1. **Anthropic公式サイトにアクセス**
   - URL: https://www.anthropic.com/
   - 「Sign Up」または「Get Started」をクリック

2. **アカウント作成**
   - メールアドレスを入力
   - パスワードを設定
   - メール認証を完了

3. **コンソールにログイン**
   - https://console.anthropic.com/ にアクセス
   - 作成したアカウントでログイン

## 🔐 ステップ2: APIキーの取得

1. **API Keysページに移動**
   - コンソールの左メニューから「API Keys」を選択
   - または直接: https://console.anthropic.com/settings/keys

2. **新しいAPIキーを作成**
   - 「Create Key」ボタンをクリック
   - キー名を入力（例: "law-review-system"）
   - 「Create Key」をクリック

3. **APIキーをコピー**
   - ⚠️ **重要**: APIキーは一度しか表示されません
   - 必ず安全な場所に保存してください
   - 例: `sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## ⚙️ ステップ3: 環境変数の設定

### Windows (PowerShell) の場合

```powershell
# 一時的な設定（現在のセッションのみ）
$env:ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 永続的な設定（推奨）
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'User')
```

### Windows (コマンドプロンプト) の場合

```cmd
# 一時的な設定
set ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 永続的な設定（レジストリを使用）
setx ANTHROPIC_API_KEY "sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Linux/Mac の場合

```bash
# 一時的な設定
export ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 永続的な設定（~/.bashrc または ~/.zshrc に追加）
echo 'export ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"' >> ~/.bashrc
source ~/.bashrc
```

### .envファイルを使用する場合（推奨）

プロジェクトルートに `.env` ファイルを作成：

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**注意**: `.env` ファイルは `.gitignore` に追加して、Gitにコミットしないようにしてください。

## 🤖 ステップ4: モデルの選択

現在のデフォルトモデル: `claude-3-opus-20240229`

### 利用可能なモデル

| モデル名 | 説明 | 用途 |
|---------|------|------|
| `claude-3-5-sonnet-20241022` | 最新の高性能モデル（推奨） | 高品質な講評生成 |
| `claude-3-opus-20240229` | 最高性能モデル | 複雑な分析が必要な場合 |
| `claude-3-5-haiku-20241022` | 高速・低コストモデル | 簡単な質問応答 |

### モデルを変更する場合

環境変数で設定：

```powershell
# Windows PowerShell
$env:ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

```bash
# Linux/Mac
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

または `.env` ファイルに追加：

```env
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

## ✅ ステップ5: 動作確認

1. **アプリケーションを起動**
   ```powershell
   # FastAPIサーバーを起動
   uvicorn app.main:app --reload
   
   # 別のターミナルでStreamlitを起動
   streamlit run web.py
   ```

2. **講評生成をテスト**
   - Streamlitアプリ（http://localhost:8501）にアクセス
   - 「講評生成」ページを開く
   - 科目を選択し、答案を入力
   - 「講評を生成」ボタンをクリック
   - APIキーが正しく設定されていれば、実際のClaude APIから講評が生成されます

3. **エラーの確認**
   - APIキーが設定されていない場合、ダミーの講評が表示されます
   - APIキーが間違っている場合、エラーメッセージが表示されます
   - コンソール（ターミナル）でエラーログを確認してください

## 💰 料金について

### 料金体系（2024年10月時点）

Anthropic APIには**2つの支払い方法**があります：

1. **前払いクレジット（Prepaid Credits）** - 推奨
2. **従量課金制（Pay-as-you-go）** - クレジット残高がなくなった場合の自動課金

### 前払いクレジット（推奨）

**メリット:**
- 予算管理がしやすい
- 使用量を事前にコントロールできる
- 予期しない高額請求を防げる

**設定方法:**
1. Anthropicコンソールの「Billing」ページにアクセス
2. 「Add credits」セクションで金額を入力（$5〜$100）
3. クレジットを追加
4. 「Auto reload credits」を有効にすると、残高が一定額以下になったら自動で追加されます

**Tier（利用階層）について:**
- Tier 1: 月間最大$100のクレジットまで使用可能
- 使用量に応じてTierが上がり、上限が増加します
- Tierが高いほど、より多くのクレジットを使用できます

**クレジットの使用:**
- APIを使用すると、クレジット残高から自動的に差し引かれます
- 残高がなくなると、自動的に従量課金制に切り替わります（クレジットカード登録が必要）

### 従量課金制（Pay-as-you-go）

クレジット残高がなくなった場合、またはクレジットを設定していない場合に使用されます。

| モデル | 入力（1000トークン） | 出力（1000トークン） |
|-------|---------------------|---------------------|
| Claude 3.5 Sonnet | $3.00 | $15.00 |
| Claude 3 Opus | $15.00 | $75.00 |
| Claude 3.5 Haiku | $0.80 | $4.00 |

### クレジットカードの登録について

**重要**: Anthropic APIを使用するには、**クレジットカードの登録が必要**です。

1. **APIキー取得時**
   - APIキーを作成する際に、支払い情報（クレジットカード）の登録が求められます
   - これはAPIの利用を開始するための必須手順です

2. **無料クレジット**
   - 新規アカウントには無料クレジットが付与される場合があります
   - ただし、クレジットカードの登録は必要です（無料クレジットを使い切った後の課金のため）

3. **従量課金制**
   - 使用した分だけ課金されます
   - 月額固定料金はありません
   - 使用量に応じて自動的に課金されます

### 料金の目安

**講評生成1回あたりの目安**（答案1000文字程度の場合）:
- Claude 3.5 Sonnet: 約 $0.05 - $0.15
- Claude 3 Opus: 約 $0.20 - $0.50
- Claude 3.5 Haiku: 約 $0.01 - $0.03

**注意**: 実際の料金は、問題文・答案の長さ、講評の詳細度によって大きく変わります。

### 使用量の確認と制限設定

1. **使用量の確認**
   - Anthropicコンソールの「Usage」ページで使用量を確認できます
   - https://console.anthropic.com/settings/usage

2. **使用制限の設定**
   - 「Billing」ページで月間の使用上限を設定できます
   - 予期しない高額請求を防ぐために設定することを推奨します
   - https://console.anthropic.com/settings/billing

### 推奨設定

**前払いクレジット + 自動リロード**

1. **初期クレジットの追加**
   - 「Add credits」で$25程度を追加（テスト用）
   - 使用量に応じて調整

2. **自動リロードの設定**
   - 「Auto reload credits」を有効化
   - 最小残高を設定（例: $5）
   - 残高が$5以下になったら自動で$25を追加

3. **使用量の監視**
   - 定期的にクレジット残高を確認
   - 「Usage」ページで使用量をチェック

### コスト削減のヒント

1. **低コストモデルの使用**
   - テストや開発時は `claude-3-5-haiku-20241022` を使用
   - 本番環境でも、品質とコストのバランスを考慮してモデルを選択

2. **使用量の監視**
   - 定期的に使用量を確認
   - 異常な使用量がないかチェック

3. **プロンプトの最適化**
   - 不要な情報を削減してトークン数を削減
   - 必要最小限の情報のみを送信

4. **前払いクレジットの活用**
   - 予算を事前に設定してコストをコントロール
   - 自動リロードでサービス中断を防止

## 🔧 トラブルシューティング

### APIキーが認識されない

1. 環境変数が正しく設定されているか確認
   ```powershell
   # Windows PowerShell
   echo $env:ANTHROPIC_API_KEY
   ```

2. アプリケーションを再起動（環境変数の変更を反映）

3. `.env` ファイルを使用している場合、`python-dotenv` がインストールされているか確認

### エラーメッセージ: "Invalid API key"

- APIキーが正しくコピーされているか確認
- 先頭の `sk-ant-api03-` が含まれているか確認
- スペースや改行が含まれていないか確認

### エラーメッセージ: "Rate limit exceeded"

- APIの使用制限に達しています
- しばらく待ってから再試行してください
- より低コストなモデル（Haiku）に切り替えることを検討してください

### モデルが見つからないエラー

- モデル名が正しいか確認
- 最新のモデル名を https://docs.anthropic.com/claude/docs/models-overview で確認

## 📝 現在の実装状況

### 既に実装済みの機能

- ✅ Claude APIとの連携（`app/llm_service.py`）
- ✅ 講評生成機能
- ✅ チャット機能（講評に関する質問）
- ✅ APIキー未設定時のダミーデータ表示
- ✅ エラーハンドリング

### 設定ファイル

- `config/settings.py`: APIキーとモデルの設定
- `app/llm_service.py`: LLMサービスの実装

### 必要なパッケージ

- `anthropic>=0.18.0` (既に `requirements.txt` に含まれています)

## 🚀 次のステップ

1. APIキーを取得して設定
2. アプリケーションを再起動
3. 講評生成をテスト
4. 必要に応じてモデルを変更

## 📚 参考リンク

- Anthropic公式ドキュメント: https://docs.anthropic.com/
- APIリファレンス: https://docs.anthropic.com/claude/reference
- モデル一覧: https://docs.anthropic.com/claude/docs/models-overview
- 料金情報: https://www.anthropic.com/pricing
