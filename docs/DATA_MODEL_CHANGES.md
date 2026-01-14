# データモデル変更の提案と実装状況

## 📋 ユーザー提案の整理

### ✅ 1. ダッシュボード情報

**提案:**
- 一時的にlocalStorageに保存
- 毎朝4時にDBにInsert（日次履歴として保存）
- ユーザーによる編集も可能

**実装状況:**
- ✅ `UserDashboard`: 現在のダッシュボード情報（リアルタイム編集用）
- ✅ `UserDashboardHistory`: 日次履歴テーブル（毎朝4時に自動保存）
- ⏳ フロントエンド: localStorage統合（今後実装）
- ⏳ バッチ処理: 毎朝4時の自動保存（今後実装）

### ✅ 2. フリーチャット

**提案:**
- 新規作成時にThreadをDBにInsert
- チャットが出るごとにMessageをInsert
- ユーザーはThreadテーブルをキーにDBからクエリ

**実装状況:**
- ✅ 既に提案通り実装済み
- `Thread`テーブル: user_idで管理
- `Message`テーブル: thread_idで管理

### ⚠️ 3. 講評

**提案:**
- 作成時にReviewをInsert
- ユーザーの講評使用履歴を別テーブルで管理（全体の講評DBのidを外部キーに）
- 同テーブルを使ってクエリ

**実装状況:**
- ✅ `UserReviewHistory`: ユーザーの講評使用履歴テーブルを追加
- ⚠️ `Review`テーブル: 現在はuser_idで直接管理（変更が必要）

**注意点:**
- 現在の`Review`テーブルは`user_id`で直接管理されている
- 提案通りにするには、`Review`テーブルから`user_id`を削除し、共有講評として管理する必要がある
- これは既存データとの互換性の問題があるため、マイグレーション戦略が必要

**推奨アプローチ:**
1. 段階的な移行:
   - Phase 1: `UserReviewHistory`テーブルを追加（完了）
   - Phase 2: 新しい講評作成時に`Review`（user_idなし）と`UserReviewHistory`の両方にInsert
   - Phase 3: 既存データの移行
   - Phase 4: `Review`テーブルから`user_id`を削除

2. または、後方互換性を保つ:
   - `Review`テーブルに`user_id`を残しつつ、`UserReviewHistory`で履歴管理
   - 共有講評機能は別途実装

### ✅ 4. ユーザー設定

**提案:**
- ユーザーごとに設定テーブルを作成

**実装状況:**
- ✅ `UserPreference`テーブル: 既に実装済み

## 🎯 実装優先順位

### Phase 1: テーブル追加（完了）
1. ✅ `UserDashboardHistory`テーブル追加
2. ✅ `UserReviewHistory`テーブル追加

### Phase 2: API実装（今後）
1. ⏳ ダッシュボード情報API（GET/PUT /v1/users/me/dashboard）
2. ⏳ ダッシュボード履歴API（GET /v1/users/me/dashboard/history）
3. ⏳ 講評履歴API（GET /v1/users/me/reviews）
4. ⏳ 講評作成APIの修正（Review + UserReviewHistoryの両方にInsert）

### Phase 3: フロントエンド統合（今後）
1. ⏳ ダッシュボードページ: localStorage統合
2. ⏳ ダッシュボードページ: 自動保存機能
3. ⏳ 講評ページ: 履歴表示

### Phase 4: バッチ処理（今後）
1. ⏳ 毎朝4時のダッシュボード履歴保存バッチ

## 📊 データモデルの変更

### 追加されたテーブル

#### UserDashboardHistory
```python
- user_id: ForeignKey("users.id")
- date: String(10)  # "2024-01-15"形式
- today_goal: Text
- focus_memo: Text
- study_items: Text
- timer_elapsed_seconds: Integer
```

#### UserReviewHistory
```python
- user_id: ForeignKey("users.id")
- review_id: ForeignKey("reviews.id")
- user_answer_text: Text
- created_at: DateTime
```

### 変更が必要なテーブル

#### Review（提案通りにする場合）
- `user_id`カラムを削除（共有講評として管理）
- `UserReviewHistory`でユーザー履歴を管理

**注意:** 既存データとの互換性の問題があるため、段階的な移行が必要

## 💡 推奨される実装方針

### オプション1: 段階的移行（推奨）
1. 現在の`Review`テーブルは`user_id`を保持
2. 新しい講評作成時に`UserReviewHistory`にもInsert
3. 既存データを`UserReviewHistory`に移行
4. 将来的に`Review`テーブルから`user_id`を削除

### オプション2: 後方互換性を保つ
1. `Review`テーブルに`user_id`を残す
2. `UserReviewHistory`で追加の履歴管理
3. 共有講評機能は別途実装

ユーザーの意図を確認して、適切な方針を選択してください。
