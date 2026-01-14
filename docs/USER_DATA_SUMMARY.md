# ユーザーに紐づく情報の整理と改善提案

## 📊 現状の整理

### 1. User モデル自体の情報

```python
class User(Base):
    # 基本情報
    id: int
    email: str (unique)
    name: str (nullable)

    # Google認証情報
    google_id: str (nullable, unique)
    google_picture: str (nullable)

    # アカウント状態
    is_active: bool (default=True)
    is_admin: bool (default=False)

    # タイムスタンプ
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime (nullable)

    # ソフトデリート
    deleted_at: datetime (nullable)
```

### 2. User に紐づくリレーションシップ（実装済み）

#### ✅ 既存のリレーションシップ

- `submissions`: Submission（答案提出）
- `short_answer_sessions`: ShortAnswerSession（短答式セッション）
- `notebooks`: Notebook（ノートブック）
- `subscriptions`: UserSubscription（課金プラン履歴）
- `monthly_usage`: MonthlyUsage（月次使用量）

#### ✅ 追加したリレーションシップ（今回実装）

- `reviews`: Review（講評） - ForeignKey 制約と relationship を追加
- `threads`: Thread（チャットスレッド） - ForeignKey 制約と relationship を追加
- `preference`: UserPreference（ユーザー設定） - 新規追加
- `dashboard`: UserDashboard（ダッシュボード情報） - 新規追加

### 3. ユーザーに紐づくデータの分類

#### A. 学習データ（既存）

1. **Submission（答案提出）**

   - ユーザーが提出した答案
   - 問題情報、答案テキスト、作成日時

2. **Review（講評）**

   - 生成された講評
   - 答案テキスト、講評結果（JSON）、チャットスレッド

3. **ShortAnswerSession（短答式セッション）**

   - 短答式試験のセッション
   - 試験種別、年度、科目、問題 ID リスト

4. **ShortAnswerAnswer（短答式解答）**
   - 短答式問題への解答
   - 選択した答え、正誤判定

#### B. ノート・メモデータ（既存）

5. **Notebook（ノートブック）**

   - ユーザーのノートブック
   - タイトル、説明、カラー

6. **NoteSection（ノートセクション）**

   - ノートブック内のセクション
   - タイトル、表示順序

7. **NotePage（ノートページ）**
   - セクション内のページ
   - タイトル、コンテンツ（Markdown）

#### C. チャットデータ（既存）

8. **Thread（チャットスレッド）**

   - チャットルーム
   - タイプ（free_chat, review_chat, short_answer_chat）、タイトル

9. **Message（メッセージ）**
   - チャットメッセージ
   - ロール（user/assistant/system）、コンテンツ、LLM 情報

#### D. 課金・使用量データ（既存）

10. **UserSubscription（ユーザーサブスクリプション）**

    - 課金プラン履歴
    - プラン ID、開始日時、有効期限、支払い情報

11. **MonthlyUsage（月次使用量）**
    - 月次使用量の集計
    - 年、月、各種カウント（review_count, short_answer_session_count, chat_message_count）

#### E. 設定・ダッシュボードデータ（新規追加）

12. **UserPreference（ユーザー設定）**

    - UI 設定、通知設定、表示設定
    - テーマ、言語、通知設定、表示設定

13. **UserDashboard（ダッシュボード情報）**
    - 今日の目標、メモ、タイマー設定
    - 今日の目標、集中メモ、学習項目、タイマー情報

## 🎯 改善提案の実装状況

### ✅ Phase 1: リレーションシップの追加（完了）

1. ✅ Review モデルに User リレーションシップを追加

   - ForeignKey 制約を追加
   - relationship を追加

2. ✅ Thread モデルに User リレーションシップを追加

   - ForeignKey 制約を追加
   - relationship を追加

3. ✅ User モデルにリレーションシップを追加
   - reviews, threads, preference, dashboard を追加

### ✅ Phase 2: 新規テーブルの追加（完了）

1. ✅ UserPreference テーブルを作成

   - UI 設定、通知設定、表示設定を管理

2. ✅ UserDashboard テーブルを作成
   - ダッシュボード情報を永続化

### 📋 Phase 3: API 実装（今後実装）

1. ⏳ ダッシュボード情報の保存・取得 API
2. ⏳ ユーザー設定の保存・取得 API
3. ⏳ フロントエンドの統合

## 📈 データ整合性の改善

### 外部キー制約の追加

**改善前:**

- Review.user_id: ForeignKey 未定義
- Thread.user_id: ForeignKey 未定義

**改善後:**

- ✅ Review.user_id: ForeignKey("users.id", ondelete="CASCADE")
- ✅ Thread.user_id: ForeignKey("users.id", ondelete="CASCADE")
- ✅ すべての user_id に ForeignKey 制約を追加

### インデックスの最適化

**既存のインデックス:**

- `idx_reviews_user_created`: (user_id, created_at)
- `idx_threads_user_type_archived_last`: (user_id, type, is_archived, last_message_at)
- `idx_user_notebooks`: (user_id, created_at)
- `idx_user_started_at`: (user_id, started_at)

**新規追加:**

- `idx_user_preferences`: (user_id)
- `idx_user_dashboard`: (user_id)

## 🔄 データフロー

### ユーザー作成時

1. User レコード作成
2. UserPreference レコード自動作成（デフォルト値）
3. UserDashboard レコード自動作成（空の状態）

### ユーザー削除時（CASCADE）

1. User 削除
2. 関連データが自動削除:
   - Submissions（SET NULL）
   - Reviews（CASCADE）
   - Threads（CASCADE）
   - Notebooks（CASCADE）
   - ShortAnswerSessions（CASCADE）
   - UserSubscriptions（CASCADE）
   - MonthlyUsage（CASCADE）
   - UserPreference（CASCADE）
   - UserDashboard（CASCADE）

## 💡 推奨される次のステップ

### 1. API エンドポイントの実装

#### ダッシュボード情報 API

- `GET /v1/users/me/dashboard` - ダッシュボード情報取得
- `PUT /v1/users/me/dashboard` - ダッシュボード情報更新

#### ユーザー設定 API

- `GET /v1/users/me/preferences` - 設定取得
- `PUT /v1/users/me/preferences` - 設定更新

### 2. フロントエンド統合

#### ダッシュボードページ

- データベースから情報を取得
- 自動保存機能の実装

#### 設定ページ

- ユーザー設定の表示・編集
- 設定の永続化

### 3. データマイグレーション

既存のユーザーに対して:

- UserPreference レコードの自動作成
- UserDashboard レコードの自動作成

## 📝 まとめ

### ✅ 完了した改善

1. Review と Thread に User リレーションシップを追加
2. 外部キー制約の追加（データ整合性向上）
3. UserPreference テーブルの追加
4. UserDashboard テーブルの追加

### 🎯 改善の効果

1. **データ整合性の向上**: 外部キー制約により、不正なデータを防止
2. **クエリの簡素化**: リレーションシップにより、`user.reviews`のように直接アクセス可能
3. **将来の拡張性**: 設定管理とダッシュボード情報の基盤を構築
4. **ユーザー体験の向上**: データの永続化により、デバイス間で情報を共有可能

### 📊 データ構造の全体像

```
User
├── submissions (Submission[])
├── reviews (Review[])
├── short_answer_sessions (ShortAnswerSession[])
├── notebooks (Notebook[])
├── threads (Thread[])
├── subscriptions (UserSubscription[])
├── monthly_usage (MonthlyUsage[])
├── preference (UserPreference) [1:1]
└── dashboard (UserDashboard) [1:1]
```

すべての実装が完了し、構文エラーもありません。
