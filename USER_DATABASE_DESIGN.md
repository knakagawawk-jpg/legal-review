# ユーザー管理機能 データベース設計

## データの所有関係の整理

### 共有データ（全ユーザー共通・ユーザーID不要）

これらのテーブルは**問題データ**であり、全ユーザーが共有します：

1. **`problems`** - 論文式問題データ
   - 試験種別、年度、科目、問題文など
   - **ユーザーID不要** ✅

2. **`short_answer_problems`** - 短答式問題データ
   - 試験種別、年度、科目、問題文、選択肢、正解など
   - **ユーザーID不要** ✅

### ユーザー固有データ（ユーザーID必要）

これらのテーブルは**ユーザーが作成したデータ**です：

1. **`submissions`** - ユーザーが作成した答案
   - **`user_id` を追加する必要がある** ⚠️
   - 既存データ: `user_id = NULL` のまま（匿名ユーザー扱い）

2. **`reviews`** - ユーザーの答案に対する講評
   - `submission_id` 経由で `submissions` と紐づく
   - **直接 `user_id` は不要** ✅（`submission.user_id` でアクセス可能）

3. **`short_answer_sessions`** - ユーザーの短答式セッション
   - **既に `user_id` カラムが存在**（NULL可）
   - **NOT NULL に変更する必要がある** ⚠️

4. **`short_answer_answers`** - ユーザーの回答
   - `session_id` 経由で `short_answer_sessions` と紐づく
   - **直接 `user_id` は不要** ✅（`session.user_id` でアクセス可能）

## 必要な変更

### 既存テーブルの変更

#### 1. `submissions` テーブル

```python
# app/models.py の Submission クラスに追加

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # 新規追加
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=True)
    subject = Column(String(50), nullable=False)
    question_text = Column(Text, nullable=True)
    answer_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="submissions")  # 新規追加
    problem = relationship("Problem", back_populates="submissions")
    review = relationship("Review", back_populates="submission", uselist=False)
```

**変更内容:**
- `user_id` カラムを追加（NULL許容）
- `User` とのリレーションシップを追加

#### 2. `short_answer_sessions` テーブル

```python
# app/models.py の ShortAnswerSession クラスを変更

class ShortAnswerSession(Base):
    __tablename__ = "short_answer_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # NULL許容を削除
    exam_type = Column(String(20), nullable=False)
    year = Column(String(10), nullable=True)
    subject = Column(String(50), nullable=False)
    is_random = Column(Boolean, default=False)
    problem_ids = Column(Text, nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    user = relationship("User", back_populates="short_answer_sessions")  # 新規追加
    answers = relationship("ShortAnswerAnswer", back_populates="session")
```

**変更内容:**
- `user_id` を `nullable=False` に変更
- `User` とのリレーションシップを追加

## 新規データベーステーブル

### 1. `users` テーブル（必須）

ユーザー情報を管理します。

```python
class User(Base):
    __tablename__ = "users"
    
    # 基本情報
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=True)
    
    # Google認証情報
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    google_picture = Column(String(500), nullable=True)  # プロフィール画像URL
    
    # 課金情報
    subscription_plan = Column(String(20), nullable=False, default="free")  # "free", "basic", "premium"
    subscription_started_at = Column(DateTime(timezone=True), nullable=True)
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # アカウント状態
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)  # 管理者フラグ
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # リレーションシップ
    submissions = relationship("Submission", back_populates="user")
    short_answer_sessions = relationship("ShortAnswerSession", back_populates="user")
```

**カラム説明:**
- `id`: 主キー
- `email`: Gmailアドレス（ユニーク）
- `name`: 表示名
- `google_id`: GoogleアカウントのID（ユニーク）
- `google_picture`: プロフィール画像URL
- `subscription_plan`: 課金プラン（"free", "basic", "premium"）
- `subscription_started_at`: プラン開始日時
- `subscription_expires_at`: プラン有効期限（NULL = 無期限）
- `is_active`: アカウント有効フラグ
- `is_admin`: 管理者フラグ

### 2. `subscription_plans` テーブル（オプション）

課金プランの定義を管理します。設定ファイルで管理する場合は不要です。

```python
class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_code = Column(String(20), unique=True, nullable=False)  # "free", "basic", "premium"
    name = Column(String(50), nullable=False)  # "無料プラン", "ベーシックプラン", "プレミアムプラン"
    
    # 制限設定
    max_reviews_per_month = Column(Integer, nullable=True)  # NULL = 無制限
    max_short_answer_sessions_per_month = Column(Integer, nullable=True)
    max_chat_messages_per_review = Column(Integer, nullable=True)  # 講評チャットの制限
    
    # 価格情報
    price_monthly = Column(Integer, nullable=True)  # 月額料金（円、NULL = 無料）
    price_yearly = Column(Integer, nullable=True)  # 年額料金（円）
    
    # 機能フラグ
    features = Column(Text, nullable=True)  # JSON形式で機能リストを保存
    
    # 表示設定
    is_active = Column(Boolean, default=True)  # プランが有効かどうか
    display_order = Column(Integer, default=0)  # 表示順序
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

**カラム説明:**
- `plan_code`: プランコード（"free", "basic", "premium"）
- `name`: プラン名
- `max_reviews_per_month`: 月間講評生成上限（NULL = 無制限）
- `max_short_answer_sessions_per_month`: 月間短答式セッション上限
- `price_monthly`: 月額料金（円）
- `features`: 機能リスト（JSON形式）

**注意:** このテーブルは設定ファイル（`config/subscription_plans.py`）で管理する方が柔軟性が高い場合があります。

### 3. `usage_logs` テーブル（オプション）

使用量を記録します。課金プランの制限チェックに使用します。

```python
class UsageLog(Base):
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # 使用タイプ
    usage_type = Column(String(50), nullable=False)  # "review", "short_answer_session", "chat"
    
    # 関連データ
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=True)  # review の場合
    session_id = Column(Integer, ForeignKey("short_answer_sessions.id"), nullable=True)  # short_answer の場合
    
    # メタデータ
    metadata = Column(Text, nullable=True)  # JSON形式で追加情報を保存
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # リレーションシップ
    user = relationship("User")
    submission = relationship("Submission")
    session = relationship("ShortAnswerSession")
```

**カラム説明:**
- `user_id`: ユーザーID
- `usage_type`: 使用タイプ（"review", "short_answer_session", "chat"）
- `submission_id`: 講評生成の場合は submission_id
- `session_id`: 短答式セッションの場合は session_id
- `metadata`: 追加情報（JSON形式）

**注意:** このテーブルは使用量の追跡に便利ですが、既存テーブル（`reviews`, `short_answer_sessions`）から集計することも可能です。

### 4. `user_sessions` テーブル（オプション）

ログインセッションを管理します。JWTトークンを使用する場合は不要な場合があります。

```python
class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # セッション情報
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    refresh_token = Column(String(255), nullable=True)
    
    # デバイス情報
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv6対応
    
    # 有効期限
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # リレーションシップ
    user = relationship("User")
```

**カラム説明:**
- `user_id`: ユーザーID
- `session_token`: セッショントークン（JWTまたはランダム文字列）
- `refresh_token`: リフレッシュトークン（オプション）
- `expires_at`: セッション有効期限
- `last_used_at`: 最終使用日時

**注意:** JWTトークンを使用する場合、このテーブルは不要です。トークンに有効期限を含めることができます。

## データベーススキーマ図

```
users (新規)
├── id (PK)
├── email (UNIQUE)
├── google_id (UNIQUE)
├── subscription_plan
└── ...

submissions (変更)
├── id (PK)
├── user_id (FK → users.id) ← 新規追加
├── problem_id (FK → problems.id)
└── ...

reviews (変更なし)
├── id (PK)
├── submission_id (FK → submissions.id)
└── ... (submission経由でuserにアクセス)

short_answer_sessions (変更)
├── id (PK)
├── user_id (FK → users.id) ← NOT NULLに変更
└── ...

short_answer_answers (変更なし)
├── id (PK)
├── session_id (FK → short_answer_sessions.id)
└── ... (session経由でuserにアクセス)

problems (変更なし)
└── ... (共有データ)

short_answer_problems (変更なし)
└── ... (共有データ)
```

## マイグレーション戦略

### 既存データの処理

1. **`submissions` テーブル**
   - 既存レコードの `user_id` は `NULL` のまま
   - 新規レコードから `user_id` を必須にする

2. **`short_answer_sessions` テーブル**
   - 既存レコードの `user_id` が `NULL` の場合、匿名ユーザーを作成するか、エラーを出す
   - または、既存データを削除する

### マイグレーションスクリプト例

```python
# scripts/migrate_add_user_id.py

def migrate_submissions():
    """submissionsテーブルにuser_idカラムを追加"""
    # 1. user_idカラムを追加（NULL許容）
    # 2. 既存データはNULLのまま
    pass

def migrate_short_answer_sessions():
    """short_answer_sessionsテーブルのuser_idをNOT NULLに変更"""
    # 1. 匿名ユーザーを作成
    # 2. 既存のNULLレコードに匿名ユーザーIDを設定
    # 3. user_idをNOT NULLに変更
    pass
```

## まとめ

### 必須の変更

1. ✅ **`users` テーブルを新規作成**
2. ✅ **`submissions` テーブルに `user_id` を追加**
3. ✅ **`short_answer_sessions` テーブルの `user_id` を NOT NULL に変更**

### オプションのテーブル

1. ⚠️ **`subscription_plans` テーブル** - 設定ファイルで管理する場合は不要
2. ⚠️ **`usage_logs` テーブル** - 既存テーブルから集計する場合は不要
3. ⚠️ **`user_sessions` テーブル** - JWTトークンを使用する場合は不要

### 変更不要のテーブル

1. ✅ **`problems`** - 共有データ
2. ✅ **`short_answer_problems`** - 共有データ
3. ✅ **`reviews`** - `submission` 経由でユーザーに紐づく
4. ✅ **`short_answer_answers`** - `session` 経由でユーザーに紐づく
