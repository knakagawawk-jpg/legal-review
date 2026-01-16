# law-review プロジェクト概要書

> **目的**: このドキュメントは、GPTなどのLLMにプロジェクトの現状を正しく理解させ、今後の開発手順・優先順位・意思決定（インフラ/認証/DB/LLMコスト/スケール）を具体的に提案してもらうために必要な情報を整理したものです。
> 
> **注意**: 秘密情報（APIキー、個人情報、トークン、実データ）は含まれていません。現状の事実と未決事項を明確に分けています。

---

## 1. リポジトリ概要

### サービス説明
法律答案（司法試験・予備試験）の講評をAI（Claude）で自動生成するWebアプリケーション。答案を入力すると、2段階処理（構造化→評価）を経て講評を生成します。

### 現状できること
- ✅ 答案講評の生成（2段階処理：JSON化→評価）
- ✅ 講評結果の閲覧
- ✅ 問題文の選択・表示（既存問題DBから）
- ✅ 問題メタデータの管理（試験種別、年度、科目）
- ✅ Next.js UIでの講評生成・結果表示（新UI）
- ✅ Streamlit UI（旧UI、legacy profileで残存、廃止予定）
- ✅ フリーチャット機能（Streamlit UIのみ、Next.js未実装）
- ✅ 短答式問題機能（Streamlit UIのみ、Next.js未実装）
- ✅ ノート機能（APIのみ、UI未実装）

### 直近のゴール
1. **ステージング公開**: 本番環境へのデプロイ（HTTPS、Basic認証）
2. **UI改善**: Next.js UIの完成（残ページの実装）
3. **β提供**: 限定ユーザー向けの提供開始
4. **Streamlit廃止**: 完全にNext.jsへ移行

### 想定ユーザー規模と制約

**規模:**
- 総ユーザー数: 約300人（想定）
- 同時接続数: 最大50人
- 講評生成時間: 最大150秒（LLM API呼び出し時間を含む）

**制約:**
- 個人情報あり: ユーザー情報（email、Google ID）、答案データ、講評データ
- HTTPS必須: 本番環境ではHTTPSが必須（Caddyで自動証明書取得）
- レート制限: 現状LLM API側の制限のみ（アプリ側の制限は未実装）
- コスト対策: 現状未実装（レート制限、重複生成防止、ログ収集など）

---

## 2. 現状アーキテクチャ

### 全体構成図

```
[インターネット]
    ↓ HTTPS
[Caddy (proxy:80/443)]
    ↓ HTTP (内部)
[Next.js (web:3000) - BFFとして /api/* でFastAPIに転送]
    ↓ HTTP (内部ネットワーク)
[FastAPI (backend:8000)]
    ↓
[Claude API (外部)] ──┐
[SQLite (/data/dev.db)] ──┘
```

### コンテナ構成

**外部公開:**
- `proxy` (Caddy): ポート80/443を公開（本番環境のみ）
- `proxy-local` (Caddy): ポート8080:80を公開（ローカル開発用）

**内部のみ（外部非公開）:**
- `backend` (FastAPI): ポート非公開、内部ネットワークのみ
- `web` (Next.js): ポート非公開、proxy経由のみアクセス可能
- `frontend` (Streamlit): ポート非公開、legacy profileで残存（廃止予定）

### BFF（Backend For Frontend）パターン

Next.jsはBFFとして機能し、`/api/*` のRoute HandlerでFastAPIにリクエストを転送します：

- `POST /api/review` → `POST http://backend:8000/v1/review`
- `GET /api/review/[id]` → `GET http://backend:8000/v1/review/{id}`
- `GET /api/problems/metadata` → `GET http://backend:8000/v1/problems/metadata`
- その他、問題系API、ヘルスチェックなど

**重要な特徴:**
- フロントエンド（ブラウザ）は直接FastAPIにアクセスしない
- すべてのリクエストはNext.jsのRoute Handlerを経由
- タイムアウト設定: `REVIEW_TIMEOUT_MS`（デフォルト: 240000ms = 240秒）
- キャッシュ: `cache: "no-store"` を明示的に設定

### 旧Streamlit UI

- `docker-compose.yml` の `frontend` サービスに `profiles: - legacy` が設定されている
- `--profile legacy` で起動可能（移行期間中のみ）
- 完全にNext.jsへ移行後は削除予定

---

## 3. 実行手順

### ローカル開発環境

```bash
# 1. リポジトリのクローン（初回のみ）
git clone <repository-url> law-review
cd law-review

# 2. .envファイルの作成
cp .env.example .env
# .envファイルを編集して、ANTHROPIC_API_KEYを設定

# 3. Docker Composeで起動（local profile）
docker compose --profile local up -d --build

# 4. アクセス
# http://localhost:8080 でNext.js UIにアクセス
```

**期待される出力:**
```
[+] Building ...
[+] Running 4/4
 ✔ Container law-review-backend       Started
 ✔ Container law-review-web           Started
 ✔ Container law-review-proxy-local   Started
```

### 本番環境（ステージング）

```bash
# 1. リポジトリのクローン（VPS上）
git clone <repository-url> law-review
cd law-review

# 2. .envファイルの作成
cp .env.example .env
# .envファイルを編集して、以下を設定:
#   - ANTHROPIC_API_KEY
#   - DATABASE_URL=sqlite:////data/dev.db
#   - CADDY_DOMAIN=<your-domain>
#   - ENABLE_BASIC_AUTH=true（任意）
#   - BASIC_AUTH_USER, BASIC_AUTH_PASS_HASH（Basic認証使用時）

# 3. Caddyfile.productionの生成（Basic認証使用時）
./scripts/generate-caddyfile.sh

# 4. Docker Composeで起動（production profile）
docker compose --profile production up -d --build

# 5. アクセス
# https://<your-domain> でNext.js UIにアクセス
```

### ヘルスチェック確認

```bash
# backendのヘルスチェック
docker compose exec backend curl -f http://localhost:8000/health

# webのヘルスチェック
docker compose exec web wget --quiet --tries=1 --spider http://localhost:3000/api/health

# proxyのヘルスチェック
docker compose exec proxy wget --quiet --tries=1 --spider http://localhost:2019/config/
```

**期待される出力:**
- backend: `{"status":"ok","auth_enabled":false}`
- web: エラーコードなし（200 OK）
- proxy: エラーコードなし（200 OK）

### ログ確認

```bash
# 全サービスのログ
docker compose logs -f

# 特定サービスのログ
docker compose logs -f backend
docker compose logs -f web
docker compose logs -f proxy

# 最新50行のみ
docker compose logs --tail=50
```

### 更新手順

```bash
# 1. 最新コードを取得
git pull origin main

# 2. コンテナを再ビルドして起動
docker compose --profile production up -d --build

# 3. ログを確認
docker compose logs -f

# 4. ヘルスチェック
docker compose ps
docker compose exec backend curl -f http://localhost:8000/health
```

---

## 4. 環境変数一覧

### backend（FastAPI）

| 環境変数 | 必須/任意 | デフォルト値 | 説明 |
|---------|---------|------------|------|
| `DATABASE_URL` | 任意 | `sqlite:///./dev.db` | SQLiteの接続文字列（Docker環境では`sqlite:////data/dev.db`） |
| `ANTHROPIC_API_KEY` | **必須** | - | Anthropic APIキー（講評生成に必要） |
| `ANTHROPIC_MODEL` | 任意 | `claude-3-opus-20240229` | 使用するClaudeモデル |
| `AUTH_ENABLED` | 任意 | `false` | 認証機能の有効化（現在は`false`） |
| `GOOGLE_CLIENT_ID` | 任意（認証ON時） | - | Google認証のクライアントID |
| `GOOGLE_CLIENT_SECRET` | 任意（認証ON時） | - | Google認証のクライアントシークレット |
| `SECRET_KEY` | 任意 | `change-this-secret-key-in-production` | JWT署名用のシークレットキー |

### web（Next.js）

| 環境変数 | 必須/任意 | デフォルト値 | 説明 |
|---------|---------|------------|------|
| `BACKEND_INTERNAL_URL` | 任意 | `http://backend:8000` | FastAPIへの内部接続URL（BFFとして転送先） |
| `REVIEW_TIMEOUT_MS` | 任意 | `240000` | 講評生成のタイムアウト（ミリ秒、240秒=4分） |
| `NODE_ENV` | 任意 | `production` | Node.jsの環境変数（Docker環境では`production`） |

### proxy（Caddy）

**Caddyfile.production使用時（環境変数から動的生成）:**

| 環境変数 | 必須/任意 | デフォルト値 | 説明 |
|---------|---------|------------|------|
| `CADDY_DOMAIN` | 必須（本番） | `localhost` | CaddyでHTTPS証明書を取得するドメイン名 |
| `ENABLE_BASIC_AUTH` | 任意 | `false` | Basic認証の有効化 |
| `BASIC_AUTH_USER` | 任意（Basic認証ON時） | `admin` | Basic認証のユーザー名 |
| `BASIC_AUTH_PASS_HASH` | 任意（Basic認証ON時） | - | Basic認証のパスワードハッシュ（`caddy hash-password --plaintext "password"`で生成） |
| `CADDYFILE_PATH` | 任意 | `./Caddyfile.production` | 使用するCaddyfileのパス（カスタムCaddyfile使用時） |

**注意:**
- `.env.example` ファイルに上記の環境変数が記載されている（値は例示のみ）
- 実際の `.env` ファイルには、秘密情報（APIキー、パスワードハッシュ）を設定
- `.env` ファイルは `.gitignore` で除外されている

---

## 5. API一覧（FastAPIエンドポイント）

### 認証状態

**現状:** 認証は無効化されている（`AUTH_ENABLED=false`）

- エンドポイントは `get_current_user` を使用しているが、認証OFF時は `None` を返す
- `user_id` は `submissions` テーブルに保存されるが、`None` になる（認証OFF時）
- Google認証エンドポイント（`POST /v1/auth/google`）は存在するが、認証OFF時はエラーを返す

**予定:** 将来的に認証を有効化する予定（時期未定）

### 主要エンドポイント

#### ヘルスチェック

- `GET /health`
  - 認証: 不要
  - レスポンス: `{"status": "ok", "auth_enabled": false}`

#### 講評関連

- `POST /v1/review`
  - 認証: オプション（認証OFF時は `user_id=None`）
  - 用途: 答案から講評を生成
  - リクエスト: `ReviewRequest`（`subject`, `answer_text`, `question_text`（任意）, `problem_id`（任意）, `problem_metadata_id`（任意）, `problem_details_id`（任意））
  - レスポンス: `ReviewResponse`（`submission_id`, `review_markdown`, `review_json`, `answer_text`, `question_text`, `subject`, `purpose`）
  - 所要時間: 最大150秒（LLM API呼び出し時間を含む）
  - 失敗時の挙動: HTTPException（500）、エラーメッセージを返す（APIキーエラー、タイムアウト、レート制限、JSONパースエラーなど）

- `GET /v1/review/{submission_id}`
  - 認証: 不要
  - 用途: 生成済み講評を取得
  - レスポンス: `ReviewResponse`

- `POST /v1/review/chat`
  - 認証: オプション
  - 用途: 講評に関する質問にチャット形式で回答
  - リクエスト: `ReviewChatRequest`（`submission_id`, `question`, `chat_history`（任意））
  - レスポンス: `ReviewChatResponse`（`answer`）

- `POST /v1/chat`
  - 認証: 不要
  - 用途: フリーチャット（文脈に縛られない汎用的なチャット）
  - リクエスト: `FreeChatRequest`（`question`, `chat_history`（任意））
  - レスポンス: `FreeChatResponse`（`answer`）

#### 問題関連

- `GET /v1/problems/metadata`
  - 認証: 不要
  - 用途: 問題メタデータ一覧を取得（試験種別、年度、科目でフィルタ可能）
  - クエリパラメータ: `exam_type`（任意）, `year`（任意）, `subject`（任意）
  - レスポンス: `ProblemMetadataListResponse`

- `GET /v1/problems/metadata/{metadata_id}`
  - 認証: 不要
  - 用途: 問題メタデータと詳細を取得
  - レスポンス: `ProblemMetadataWithDetailsResponse`

- `GET /v1/problems/subjects`
  - 認証: 不要
  - 用途: 科目一覧を取得
  - レスポンス: `ProblemSubjectsResponse`

- `GET /v1/problems/years`
  - 認証: 不要
  - 用途: 年度一覧を取得
  - レスポンス: `ProblemYearsResponse`

- `GET /v1/problems`（旧構造、後方互換性用）
- `GET /v1/problems/{problem_id}`（旧構造、後方互換性用）
- `POST /v1/problems`（管理用、認証不要）
- `PUT /v1/problems/{problem_id}`（管理用、認証不要）

#### 短答式問題関連

- `GET /v1/short-answer/problems`
- `GET /v1/short-answer/problems/{problem_id}`
- `POST /v1/short-answer/sessions`
- `GET /v1/short-answer/sessions/{session_id}`
- `POST /v1/short-answer/answers`
- `GET /v1/short-answer/sessions/{session_id}/answers`

**注意:** 短答式問題機能はStreamlit UIでのみ実装されており、Next.js UIでは未実装

#### ユーザー関連（認証OFF時は未使用）

- `POST /v1/auth/google`
- `GET /v1/users/me`
- `GET /v1/users/me/submissions`
- `GET /v1/users/me/short-answer-sessions`

**注意:** 認証が無効化されているため、これらのエンドポイントは現在使用されていない

#### ノート機能関連（APIのみ、UI未実装）

- `GET /v1/notebooks`
- `POST /v1/notebooks`
- `GET /v1/notebooks/{notebook_id}`
- `PUT /v1/notebooks/{notebook_id}`
- `DELETE /v1/notebooks/{notebook_id}`
- `POST /v1/note-sections`
- `PUT /v1/note-sections/{section_id}`
- `DELETE /v1/note-sections/{section_id}`
- `POST /v1/note-pages`
- `PUT /v1/note-pages/{page_id}`
- `DELETE /v1/note-pages/{page_id}`

**注意:** ノート機能のAPIは実装されているが、UI（Next.js/Streamlit）は未実装

---

## 6. フロント（Next.js）の画面一覧とルーティング

### 実装済みページ

#### `/`（ルート）
- ファイル: `web_next/app/page.tsx`
- 状態: 実装済み（基本的なランディングページまたはリダイレクト）

#### `/review`（講評生成ページ）
- ファイル: `web_next/app/review/page.tsx`
- 状態: **実装済み**
- 機能:
  - 3ステップUI（Step 1: 問題準備 / Step 2: 答案入力 / Step 3: 生成）
  - モード切替（既存問題選択 / 新規入力）
  - 問題フィルター（試験種別、年度、科目）
  - 問題文表示・コピー
  - 答案入力（Textarea、文字数カウンター、localStorage保持）
  - 生成ボタン（ローディング表示、フェーズ表示）
  - 成功時: `/review/[id]` にリダイレクト
  - エラー時: Alertで表示

#### `/review/[id]`（講評結果ページ）
- ファイル: `web_next/app/review/[id]/page.tsx`
- 状態: **実装済み**
- 機能:
  - 講評結果の表示（マークダウン形式）
  - 講評JSONの表示（構造化データ）
  - 問題文・答案の表示

### 実装済みAPI Route Handlers（BFF）

- `POST /api/review` → `POST /v1/review`
- `GET /api/review/[id]` → `GET /v1/review/{id}`
- `GET /api/problems/metadata` → `GET /v1/problems/metadata`
- `GET /api/problems/metadata/[id]` → `GET /v1/problems/metadata/{id}`
- `GET /api/problems/subjects` → `GET /v1/problems/subjects`
- `GET /api/health` → ヘルスチェック

**特徴:**
- すべて `cache: "no-store"` を設定
- タイムアウト: `REVIEW_TIMEOUT_MS`（デフォルト: 240秒）
- エラーハンドリング: フロントエンド向けメッセージに変換

### 未実装ページ（優先度順）

#### 優先度高
1. **フリーチャットページ**（`/chat` または `/free-chat`）
   - 現状: Streamlit UIにのみ実装（`streamlit_app/pages/free_chat.py`）
   - API: `POST /v1/chat` は実装済み
   - TODO: Next.js UIの実装
   - 優先度: **高**（基本的な機能）

2. **短答式問題ページ**（`/short-answer`）
   - 現状: Streamlit UIにのみ実装（`streamlit_app/pages/short_answer.py`）
   - API: 短答式問題関連APIは実装済み
   - TODO: Next.js UIの実装（問題選択、セッション開始、回答、結果表示）
   - 優先度: **高**（既存機能の移行）

#### 優先度中
3. **マイページ**（`/my-page` または `/dashboard`）
   - 現状: Streamlit UIにのみ実装（`streamlit_app/pages/your_page.py`）
   - API: `GET /v1/users/me/submissions`, `GET /v1/users/me/short-answer-sessions` は実装済み（認証OFF時は未使用）
   - TODO: Next.js UIの実装（講評履歴、短答式履歴、使用量統計など）
   - 優先度: **中**（認証実装後）

4. **ノート機能**（`/notebooks`, `/notebooks/[id]`）
   - 現状: APIのみ実装、UIは未実装
   - API: ノート機能関連APIは実装済み
   - TODO: Next.js UIの実装（ノートブック一覧、セクション・ページ管理）
   - 優先度: **中**（機能追加）

#### 優先度低
5. **管理ページ**（`/admin`）
   - 現状: 未実装
   - TODO: 問題の追加・編集、ユーザー管理、使用量統計など
   - 優先度: **低**（管理者向け）

### 旧Streamlit UIのページ一覧（参考）

- `/review` - 講評生成ページ
- `/review_result` - 講評結果ページ（`submission_id`をクエリパラメータで受け取る）
- `/short_answer` - 短答式問題ページ
- `/free_chat` - フリーチャットページ
- `/your_page` - マイページ（講評履歴、短答式履歴など）
- `/dev` - 開発用ページ（デバッグ情報など）

**注意:** Streamlit UIは `--profile legacy` で起動可能だが、完全にNext.jsへ移行後は削除予定

---

## 7. データベース（SQLite→将来Postgres移行を見据えた情報）

### 現在のDB

- **型**: SQLite 3
- **ファイル名**: `dev.db`
- **場所**: 
  - ローカル開発: `./dev.db`（プロジェクトルート）
  - Docker環境: `/data/dev.db`（`./data` ディレクトリにマウント、永続化）
- **接続文字列**: 
  - ローカル: `sqlite:///./dev.db`
  - Docker: `sqlite:////data/dev.db`

### バックアップ

- **スクリプト**: `scripts/backup_sqlite.sh`
- **保存先**: `./backups/dev_YYYYMMDD_HHMMSS.db.gz`
- **cron設定例**（日次バックアップ）:
  ```bash
  0 2 * * * /path/to/law-review/scripts/backup_sqlite.sh
  ```
- **バックアップ内容**: SQLiteの `.backup` コマンドを使用（整合性を保証）
- **圧縮**: gzip（利用可能な場合）
- **古いバックアップ削除**: 30日以上前のファイルを自動削除

### テーブル一覧（14テーブル）

#### 1. 問題関連テーブル（全ユーザー共有データ）

- `problem_metadata` - 問題メタデータ（試験種別、年度、科目の組み合わせ）
- `problem_details` - 問題詳細（設問ごとの情報、`problem_metadata`に紐づく）
- `problems` - 旧構造の問題データ（後方互換性用、移行期間中に保持）
- `short_answer_problems` - 短答式問題

#### 2. ユーザー関連テーブル（ユーザー固有データ、認証OFF時は未使用）

- `users` - ユーザー情報（email、Google ID、プロフィール画像など）
- `subscription_plans` - サブスクリプションプラン定義
- `user_subscriptions` - ユーザーのサブスクリプション履歴
- `monthly_usage` - 月間使用量（講評生成回数、短答式セッション数、チャットメッセージ数）

#### 3. 講評関連テーブル（ユーザー固有データ）

- `submissions` - ユーザーが作成した答案（認証OFF時は`user_id=None`）
- `reviews` - 生成された講評結果（`submissions`に1:1で紐づく）

#### 4. 短答式関連テーブル（ユーザー固有データ）

- `short_answer_sessions` - 短答式試験のセッション情報
- `short_answer_answers` - ユーザーの回答記録

#### 5. ノート機能関連テーブル（ユーザー固有データ、UI未実装）

- `notebooks` - ノートブック（最上位のコンテナ）
- `note_sections` - セクション（`notebooks`に紐づく）
- `note_pages` - ページ（`note_sections`に紐づく）

### 個人情報を含むテーブル

- `users` - email、Google ID、プロフィール画像URL
- `submissions` - 答案テキスト（個人情報の可能性あり）
- `reviews` - 講評結果（答案に関する評価、個人情報の可能性あり）
- `short_answer_sessions` - セッション情報（ユーザーID）
- `short_answer_answers` - 回答記録（ユーザーの選択）
- `notebooks`, `note_sections`, `note_pages` - ノート内容（ユーザー固有データ）

**注意:** 認証が無効化されているため、現在は `user_id` が `NULL` のデータが保存されている

### マイグレーション方式

**現状:** Alembicなどのマイグレーションツールは未導入

- SQLAlchemyの `Base.metadata.create_all(bind=engine)` を使用してテーブルを作成
- スキーマ変更時は手動でマイグレーションスクリプトを作成（例: `migrate_to_new_problem_structure.py`）

**将来のPostgres移行:**
- Alembicの導入を検討
- スキーマ変更の履歴管理
- 本番環境での安全なマイグレーション手順の確立

### データ量の見込み

**現状（推定）:**
- 問題データ: 約50〜100件（司法試験・予備試験の過去問）
- 答案・講評データ: 未集計（開発中、テストデータのみ）
- ユーザーデータ: 0件（認証OFFのため）

**将来（300ユーザー想定、1年間）:**
- 答案・講評データ: 約10,000〜30,000件（1ユーザーあたり月10〜100回想定）
- 短答式セッション: 約5,000〜15,000件
- ノートデータ: 未定（UI未実装）
- 推定DBサイズ: 約500MB〜2GB（テキストデータが多いため）

**Postgres移行のタイミング:**
- SQLiteの同時書き込み制限に達した場合
- DBサイズが10GBを超えた場合
- より高度なクエリが必要になった場合

---

## 8. 認証・課金・利用制限（現状と予定）

### 認証

**現状:**
- Next.js側に認証機能は実装されていない
- FastAPI側には認証機能のコードは存在するが、`AUTH_ENABLED=false` で無効化されている
- `users` テーブル、Google認証のコード（`app/auth.py`）は実装済みだが、使用されていない
- `submissions` テーブルの `user_id` は常に `NULL`（認証OFF時）

**予定:**
- 認証機能の有効化時期は未定
- 認証実装時は、Next.js側に認証UIを追加する必要がある
- Google認証を使用する予定（既存コードを活用）

### 課金・利用制限

**現状:**
- 課金機能は未実装
- `subscription_plans` テーブル、`user_subscriptions` テーブルは実装済みだが、使用されていない
- `monthly_usage` テーブルは実装済みだが、集計処理は未実装

**予定:**
- 月間使用量（`monthly_usage`）を集計して、利用制限を実装する予定（時期未定）
- プランごとの制限（例: 無料プランは月10回、有料プランは無制限）を実装
- 課金処理（決済API連携）は将来の検討事項

### LLMコスト対策

**現状:**
- レート制限: **未実装**（LLM API側の制限のみ）
- 重複生成防止: **未実装**（同じ答案で複数回生成可能）
- ログ収集: **未実装**（コスト計測のためのログがない）
- キャッシュ: **未実装**（同じ問題・答案でも毎回LLM APIを呼び出す）

**予定（未決事項）:**
- レート制限の実装（ユーザー単位、IP単位など）
- 重複生成防止（同じ問題・答案のハッシュを保存し、既存講評を返す）
- コスト計測・ログ収集（使用量の可視化、アラート設定）
- キャッシュ機能（同一問題・答案の講評を再利用）

**LLMコストの目安:**
- Claude 3.5 Sonnet: 講評生成1回あたり約 $0.05 - $0.15（答案1000文字程度の場合）
- 300ユーザー、月10回/ユーザー想定: 約 $150 - $450/月
- 300ユーザー、月100回/ユーザー想定: 約 $1,500 - $4,500/月

---

## 9. スケール/性能に関する現状

### 生成時間・同時接続

- **講評生成時間**: 最大150秒（LLM API呼び出し時間を含む）
  - 第1段階（JSON化）: 約30〜60秒
  - 第2段階（評価）: 約60〜90秒
- **同時接続数**: 最大50人（想定）
- **Next.js BFFのタイムアウト**: `REVIEW_TIMEOUT_MS`（デフォルト: 240000ms = 240秒）
  - 環境変数で設定可能
  - `AbortSignal.timeout()` を使用

### FastAPIの起動設定

**現状:**
- `uvicorn` を直接起動（`CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`）
- `--workers` オプションは指定されていない（デフォルト: 1ワーカー）
- `--reload` オプションは使用されていない（本番環境用）

**将来の検討事項:**
- `--workers` オプションの設定（CPUコア数に応じて調整）
- Gunicorn + Uvicorn Workers の導入（本番環境での推奨構成）

### Next.js BFFのタイムアウト設定

**現状:**
- `REVIEW_TIMEOUT_MS` 環境変数で設定可能（デフォルト: 240000ms）
- `web_next/app/api/review/route.ts` で `AbortSignal.timeout(REVIEW_TIMEOUT_MS)` を使用
- タイムアウト時は504エラーを返す

### 既知のボトルネック

1. **LLM API呼び出し時間**
   - 150秒の生成時間はLLM API側の制約
   - 現状、非同期化やジョブキューは使用されていない（同期処理）

2. **SQLiteの同時書き込み制限**
   - SQLiteは同時書き込みに弱い（WALモードを使用しても限界あり）
   - 50同時接続での書き込み負荷が懸念される

3. **メモリ使用量**
   - 長い答案（10,000文字以上）でのメモリ使用量が大きい可能性
   - プロンプトファイルの読み込み（都度読み込み）

### ジョブ化（非同期化）の検討

**現状:** 未実装

- 講評生成は同期処理（リクエスト→レスポンスまで待機）
- Celery、Redis、RQなどのジョブキューは未導入

**将来の検討事項:**
- ジョブキューの導入（Celery + Redis など）
- 非同期処理によるレスポンス時間の改善
- ジョブステータスの追跡（進行中、完了、失敗）
- 必要となる条件:
  - 同時接続数が50人を超えた場合
  - 生成時間が150秒を超える可能性がある場合
  - ユーザー体験の改善が必要になった場合

---

## 10. デプロイ前提（未定でも良いが候補）

### VPS運用

**想定環境:**
- **VPS1台運用**を想定（初期段階）
- OS: Ubuntu 20.04以上
- ドメイン: 未取得だが、HTTPS必須のため取得が必要
- ドメイン形式: `law-review.jp` または `law-review.example.com`（wwwなし）

### HTTPS証明書

- **Caddy**が自動でLet's Encrypt証明書を取得・更新
- 初回アクセス時に自動で証明書が発行される
- 証明書は `caddy_data` ボリュームに永続化

### Basic認証

- **Caddy**でBasic認証を有効化可能（推奨）
- 環境変数 `ENABLE_BASIC_AUTH=true`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASS_HASH` で設定
- `scripts/generate-caddyfile.sh` で `Caddyfile.production` を生成
- 早期のBasic認証実装を推奨（限定公開期間中）

### ファイアウォール

- ポート80（HTTP）、443（HTTPS）のみ開放
- SSH（ポート22）は必要に応じて開放
- その他のポートは閉鎖

### クラウド環境への移行（将来の検討事項）

- AWS、GCP、Azureなどのクラウド環境への移行を検討可能
- ただし、現時点ではVPS1台運用を想定

---

## 11. 重要ファイルの場所（パス一覧）

### Docker関連

- `docker-compose.yml` - Docker Compose設定（サービス定義、プロファイル、ヘルスチェック、ボリューム）
- `Caddyfile` - ローカル開発用Caddyfile（ポート8080）
- `Caddyfile.production` - 本番環境用Caddyfile（HTTPS、Basic認証対応）
- `app/Dockerfile` - FastAPI用Dockerfile（Python 3.11-slim、uvicorn起動）
- `Dockerfile.nextjs` - Next.js用Dockerfile（multi-stage build、Node 20-alpine）
- `Dockerfile.streamlit` - Streamlit用Dockerfile（legacy profile用、廃止予定）

### バックエンド（FastAPI）

- `app/main.py` - FastAPIアプリケーションのエントリーポイント（エンドポイント定義）
- `app/llm_service.py` - LLMサービス（Claude API呼び出し、2段階処理）
- `app/db.py` - SQLAlchemy設定（エンジン、セッション、Base）
- `app/models.py` - SQLAlchemyモデル（14テーブルの定義）
- `app/schemas.py` - Pydanticスキーマ（リクエスト/レスポンスの型定義）
- `app/auth.py` - 認証機能（Google認証、JWT、現在は未使用）

### フロントエンド（Next.js）

- `web_next/app/review/page.tsx` - 講評生成ページ
- `web_next/app/review/[id]/page.tsx` - 講評結果ページ
- `web_next/app/api/review/route.ts` - BFF: POST /api/review → FastAPI
- `web_next/app/api/review/[id]/route.ts` - BFF: GET /api/review/[id] → FastAPI
- `web_next/app/api/problems/metadata/route.ts` - BFF: 問題メタデータ取得
- `web_next/app/api/problems/metadata/[id]/route.ts` - BFF: 問題メタデータ詳細取得
- `web_next/app/api/problems/subjects/route.ts` - BFF: 科目一覧取得
- `web_next/app/api/health/route.ts` - ヘルスチェック

### 設定・プロンプト

- `config/settings.py` - アプリケーション設定（環境変数の読み込み、dotenv使用）
- `prompts/main/input_processing.txt` - 第1段階プロンプト（答案のJSON化）
- `prompts/main/evaluation.txt` - 第2段階プロンプト（JSONの評価）

### スクリプト

- `scripts/backup_sqlite.sh` - SQLiteバックアップスクリプト（日次バックアップ用）
- `scripts/generate-caddyfile.sh` - Caddyfile.production生成スクリプト（環境変数から動的生成）

### ドキュメント

- `DEPLOY_PRODUCTION.md` - 本番環境デプロイ手順書（Ubuntu VPS向け、初心者向け）
- `BASIC_AUTH_SETUP.md` - Basic認証セットアップガイド
- `docs/DATABASE_SCHEMA.md` - データベーススキーマ詳細（14テーブルの説明）
- `README.md` - プロジェクトの概要（Next.js移行について記載）

### 旧UI（Streamlit、廃止予定）

- `web.py` - Streamlitアプリケーションのエントリーポイント
- `streamlit_app/pages/review.py` - 講評生成ページ（旧UI）
- `streamlit_app/pages/review_result.py` - 講評結果ページ（旧UI）
- `streamlit_app/pages/short_answer.py` - 短答式問題ページ（旧UI）
- `streamlit_app/pages/free_chat.py` - フリーチャットページ（旧UI）
- `streamlit_app/pages/your_page.py` - マイページ（旧UI）

---

## 12. 未決事項リスト（質問形式で列挙）

GPTに相談すべき未決事項として、以下の質問を列挙します。これらについて、優先順位、実装順序、技術選択などの具体的な提案を求めます。

### インフラ・デプロイ

1. **デプロイ先（VPS/クラウド）をどれにするか**
   - VPS1台運用 vs AWS/GCP/Azureなどのクラウド環境
   - 初期コスト、スケール性、運用のしやすさを考慮した選択

2. **ドメイン取得とDNS設定**
   - ドメイン名の決定（`law-review.jp` vs `law-review.example.com` など）
   - DNS設定の手順（Aレコード、CNAMEなど）

3. **監視・ログ収集をいつ入れるか**
   - ログ収集ツール（ELK、Loki、CloudWatchなど）の選定
   - エラー監視（Sentry、Rollbarなど）の導入時期
   - メトリクス収集（Prometheus、Datadogなど）の必要性

### データベース

4. **DBをいつPostgresへ移行するか**
   - SQLiteからPostgresへの移行タイミング
   - 移行手順（データ移行、ダウンタイム最小化）
   - Alembicなどのマイグレーションツールの導入

5. **データバックアップ戦略**
   - 現在の日次バックアップで十分か
   - クラウドストレージ（S3、GCSなど）へのバックアップ自動アップロード
   - バックアップの保持期間・削除ポリシー

### パフォーマンス・スケール

6. **生成をジョブ化するタイミング（必要条件）**
   - Celery + Redis などのジョブキューの導入タイミング
   - 同期処理から非同期処理への移行条件（同時接続数、生成時間など）
   - ジョブステータス追跡のUI実装

7. **FastAPIのワーカー数の最適化**
   - `--workers` オプションの設定値
   - Gunicorn + Uvicorn Workers の導入検討
   - メモリ・CPU使用量の監視

### 認証・課金・利用制限

8. **認証/課金/利用制限の実装順**
   - 認証機能の有効化タイミング
   - 利用制限（月間使用量）の実装タイミング
   - 課金処理（決済API連携）の実装タイミング
   - プラン設計（無料/有料プランの内容）

9. **LLMコスト対策の実装優先度**
   - レート制限の実装（ユーザー単位、IP単位など）
   - 重複生成防止（キャッシュ機能）
   - コスト計測・ログ収集の実装
   - 使用量アラートの設定

### UI・機能実装

10. **UI（残ページ）をどの順でNext.jsに移すか**
    - フリーチャットページ（優先度高）
    - 短答式問題ページ（優先度高）
    - マイページ（優先度中、認証実装後）
    - ノート機能（優先度中、機能追加）
    - 管理ページ（優先度低）

11. **Streamlit UIの完全廃止タイミング**
    - すべての機能がNext.jsに移行完了した時点
    - 移行期間中の並行運用期間の設定

### セキュリティ・コンプライアンス

12. **個人情報保護の対応**
    - データの暗号化（保存時、転送時）
    - アクセスログの管理
    - プライバシーポリシーの作成

13. **セキュリティ監査・ペネトレーションテスト**
    - 実施タイミング
    - 実施方法（自社/外部委託）

---

## まとめ

このプロジェクトは、**法律答案講評システム**として、Next.js（BFF）+ FastAPI + SQLite + Claude API の構成で開発されています。

**現状の特徴:**
- 認証は無効化（将来的に有効化予定）
- 講評生成は同期処理（最大150秒）
- SQLiteを使用（将来的にPostgres移行予定）
- レート制限・コスト対策は未実装
- Next.js UIは部分実装（講評生成・結果表示のみ）

**直近の優先事項:**
1. ステージング公開（HTTPS、Basic認証）
2. Next.js UIの完成（フリーチャット、短答式問題の移行）
3. 認証機能の有効化
4. 利用制限・コスト対策の実装

**技術的な課題:**
- SQLiteの同時書き込み制限（50同時接続時の懸念）
- LLM API呼び出し時間（150秒）の非同期化検討
- コスト管理（レート制限、重複生成防止、ログ収集）

このドキュメントを基に、GPTに対して具体的な開発手順・優先順位・意思決定の提案を求めます。
