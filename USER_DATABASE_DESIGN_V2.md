# ユーザー管理機能 データベース設計 v2（改善版）

## 設計方針の改善点

### 1. 課金プラン管理の改善
- ❌ `users`テーブルに直接`subscription_plan`を保存 → 履歴が追えない
- ✅ `user_subscriptions`テーブルで履歴を管理 → プラン変更履歴を追跡可能

### 2. 使用量管理の最適化
- ❌ `usage_logs`テーブルで個別に記録 → 冗長でパフォーマンス低下
- ✅ 既存テーブルから集計 + `monthly_usage`テーブルで月次集計をキャッシュ

### 3. 認証管理の簡素化
- ❌ `user_sessions`テーブルで管理 → JWT使用時は不要
- ✅ JWTトークン + Streamlitの`st.session_state`で管理

### 4. データ整合性の向上
- 外部キー制約を適切に設定
- インデックスを最適化
- ソフトデリート対応

## データベーススキーマ設計

### 必須テーブル

#### 1. `users` テーブル（必須）

ユーザーの基本情報を管理します。

```python
class User(Base):
    __tablename__ = "users"
    
    # 基本情報
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=True)
    
    # Google認証情報
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    google_picture = Column(String(500), nullable=True)
    
    # アカウント状態
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    
    # ソフトデリート
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # リレーションシップ
    subscriptions = relationship("UserSubscription", back_populates="user", order_by="desc(UserSubscription.started_at)")
    current_subscription = relationship("UserSubscription", 
                                       primaryjoin="and_(User.id==UserSubscription.user_id, UserSubscription.is_active==True)",
                                       uselist=False)
    submissions = relationship("Submission", back_populates="user")
    short_answer_sessions = relationship("ShortAnswerSession", back_populates="user")
    monthly_usage = relationship("MonthlyUsage", back_populates="user")
```

**改善点:**
- ✅ `subscription_plan`を削除 → `user_subscriptions`テーブルで管理
- ✅ `deleted_at`を追加 → ソフトデリート対応
- ✅ `current_subscription`リレーションシップを追加 → 現在のプランに簡単アクセス

#### 2. `subscription_plans` テーブル（推奨）

課金プランの定義を管理します。設定ファイルでも管理可能ですが、DBで管理すると柔軟性が高いです。

```python
class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_code = Column(String(20), unique=True, nullable=False, index=True)  # "free", "basic", "premium"
    name = Column(String(50), nullable=False)  # "無料プラン", "ベーシックプラン", "プレミアムプラン"
    description = Column(Text, nullable=True)  # プラン説明
    
    # 制限設定（JSON形式で柔軟に管理）
    limits = Column(Text, nullable=False)  # JSON形式: {"max_reviews_per_month": 50, "max_sessions_per_month": 100}
    
    # 価格情報
    price_monthly = Column(Integer, nullable=True)  # 月額料金（円、NULL = 無料）
    price_yearly = Column(Integer, nullable=True)  # 年額料金（円）
    
    # 機能フラグ（JSON形式で柔軟に管理）
    features = Column(Text, nullable=True)  # JSON形式: ["review_generation", "short_answer", "chat"]
    
    # 表示設定
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user_subscriptions = relationship("UserSubscription", back_populates="plan")
```

**改善点:**
- ✅ `limits`と`features`をJSON形式で管理 → 柔軟に機能を追加可能
- ✅ `description`を追加 → UI表示用

#### 3. `user_subscriptions` テーブル（必須）

ユーザーの課金プラン履歴を管理します。

```python
class UserSubscription(Base):
    __tablename__ = "user_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False, index=True)
    
    # サブスクリプション状態
    is_active = Column(Boolean, default=True, nullable=False, index=True)  # 現在有効なプランか
    started_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # NULL = 無期限（プレミアムなど）
    
    # 支払い情報（将来の拡張用）
    payment_method = Column(String(50), nullable=True)  # "google_play", "stripe", etc.
    payment_id = Column(String(255), nullable=True)  # 外部決済システムのID
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)  # キャンセル日時
    
    # リレーションシップ
    user = relationship("User", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="user_subscriptions")
    
    # インデックス
    __table_args__ = (
        Index('idx_user_active_subscription', 'user_id', 'is_active'),
    )
```

**改善点:**
- ✅ プラン変更履歴を追跡可能
- ✅ 複数のプラン変更に対応
- ✅ `is_active`フラグで現在のプランを簡単に取得
- ✅ 外部キーに`ondelete="CASCADE"`を設定

#### 4. `monthly_usage` テーブル（推奨）

月次使用量を集計してキャッシュします。パフォーマンス向上のため。

```python
class MonthlyUsage(Base):
    __tablename__ = "monthly_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 集計期間
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    
    # 使用量カウント
    review_count = Column(Integer, default=0, nullable=False)
    short_answer_session_count = Column(Integer, default=0, nullable=False)
    chat_message_count = Column(Integer, default=0, nullable=False)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="monthly_usage")
    
    # ユニーク制約
    __table_args__ = (
        UniqueConstraint('user_id', 'year', 'month', name='uq_user_monthly_usage'),
        Index('idx_user_year_month', 'user_id', 'year', 'month'),
    )
```

**改善点:**
- ✅ 月次集計をキャッシュ → クエリパフォーマンス向上
- ✅ ユニーク制約で重複を防止
- ✅ 既存テーブルから集計して更新

### 既存テーブルの変更

#### 1. `submissions` テーブル

```python
class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)  # 新規追加
    problem_id = Column(Integer, ForeignKey("problems.id", ondelete="SET NULL"), nullable=True)
    subject = Column(String(50), nullable=False)
    question_text = Column(Text, nullable=True)
    answer_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="submissions")
    problem = relationship("Problem", back_populates="submissions")
    review = relationship("Review", back_populates="submission", uselist=False)
    
    # インデックス
    __table_args__ = (
        Index('idx_user_created_at', 'user_id', 'created_at'),
    )
```

**変更点:**
- ✅ `user_id`を追加（NULL許容）
- ✅ 外部キーに`ondelete="SET NULL"`を設定 → ユーザー削除時もデータ保持
- ✅ インデックスを追加 → ユーザー別の答案取得を高速化

#### 2. `short_answer_sessions` テーブル

```python
class ShortAnswerSession(Base):
    __tablename__ = "short_answer_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)  # NOT NULLに変更
    exam_type = Column(String(20), nullable=False)
    year = Column(String(10), nullable=True)
    subject = Column(String(50), nullable=False)
    is_random = Column(Boolean, default=False, nullable=False)
    problem_ids = Column(Text, nullable=False)  # JSON配列
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # リレーションシップ
    user = relationship("User", back_populates="short_answer_sessions")
    answers = relationship("ShortAnswerAnswer", back_populates="session", cascade="all, delete-orphan")
    
    # インデックス
    __table_args__ = (
        Index('idx_user_started_at', 'user_id', 'started_at'),
    )
```

**変更点:**
- ✅ `user_id`を`nullable=False`に変更
- ✅ 外部キーに`ondelete="CASCADE"`を設定 → ユーザー削除時にセッションも削除
- ✅ インデックスを追加

## データベーススキーマ図（改善版）

```
users (新規・必須)
├── id (PK)
├── email (UNIQUE, INDEX)
├── google_id (UNIQUE, INDEX)
├── is_active
└── ...

subscription_plans (新規・推奨)
├── id (PK)
├── plan_code (UNIQUE, INDEX)
├── limits (JSON)
├── features (JSON)
└── ...

user_subscriptions (新規・必須)
├── id (PK)
├── user_id (FK → users.id, CASCADE)
├── plan_id (FK → subscription_plans.id)
├── is_active (INDEX)
├── started_at
├── expires_at
└── ... (プラン変更履歴を管理)

monthly_usage (新規・推奨)
├── id (PK)
├── user_id (FK → users.id, CASCADE)
├── year, month (UNIQUE)
├── review_count
├── session_count
└── ... (月次集計キャッシュ)

submissions (変更)
├── id (PK)
├── user_id (FK → users.id, SET NULL) ← 新規追加
├── problem_id (FK → problems.id)
└── ...

reviews (変更なし)
├── id (PK)
├── submission_id (FK → submissions.id)
└── ... (submission経由でuserにアクセス)

short_answer_sessions (変更)
├── id (PK)
├── user_id (FK → users.id, CASCADE) ← NOT NULLに変更
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

## 使用量チェックの実装

### 方法1: 既存テーブルから集計（シンプル）

```python
# app/utils/usage_check.py

from datetime import datetime
from sqlalchemy import func, extract
from app.models import User, Review, Submission, ShortAnswerSession

def get_current_subscription(user: User, db: Session):
    """現在のサブスクリプションプランを取得"""
    return db.query(UserSubscription).filter(
        UserSubscription.user_id == user.id,
        UserSubscription.is_active == True
    ).first()

def check_review_limit(user: User, db: Session) -> tuple[bool, int, int]:
    """
    講評生成の制限をチェック
    戻り値: (許可されるか, 現在の使用量, 上限)
    """
    subscription = get_current_subscription(user, db)
    if not subscription:
        # デフォルトは無料プラン
        plan_code = "free"
    else:
        plan_code = subscription.plan.plan_code
    
    # プラン設定を取得（設定ファイルまたはDBから）
    plan_config = get_plan_config(plan_code)
    max_reviews = plan_config.get("max_reviews_per_month")
    
    if max_reviews is None:
        return True, 0, float('inf')  # 無制限
    
    # 今月の使用回数をカウント
    now = datetime.now()
    count = db.query(Review).join(Submission).filter(
        Submission.user_id == user.id,
        extract('year', Review.created_at) == now.year,
        extract('month', Review.created_at) == now.month
    ).count()
    
    return count < max_reviews, count, max_reviews
```

### 方法2: monthly_usageテーブルを使用（高速）

```python
def check_review_limit_cached(user: User, db: Session) -> tuple[bool, int, int]:
    """
    講評生成の制限をチェック（キャッシュ使用）
    """
    subscription = get_current_subscription(user, db)
    plan_code = subscription.plan.plan_code if subscription else "free"
    plan_config = get_plan_config(plan_code)
    max_reviews = plan_config.get("max_reviews_per_month")
    
    if max_reviews is None:
        return True, 0, float('inf')
    
    # monthly_usageテーブルから取得
    now = datetime.now()
    usage = db.query(MonthlyUsage).filter(
        MonthlyUsage.user_id == user.id,
        MonthlyUsage.year == now.year,
        MonthlyUsage.month == now.month
    ).first()
    
    count = usage.review_count if usage else 0
    return count < max_reviews, count, max_reviews

def increment_usage(user_id: int, usage_type: str, db: Session):
    """
    使用量をインクリメント（トランザクション内で実行）
    """
    now = datetime.now()
    usage = db.query(MonthlyUsage).filter(
        MonthlyUsage.user_id == user_id,
        MonthlyUsage.year == now.year,
        MonthlyUsage.month == now.month
    ).first()
    
    if not usage:
        usage = MonthlyUsage(
            user_id=user_id,
            year=now.year,
            month=now.month
        )
        db.add(usage)
    
    if usage_type == "review":
        usage.review_count += 1
    elif usage_type == "short_answer_session":
        usage.short_answer_session_count += 1
    elif usage_type == "chat":
        usage.chat_message_count += 1
    
    db.commit()
```

## プラン設定の管理

### 設定ファイル方式（推奨・シンプル）

```python
# config/subscription_plans.py

SUBSCRIPTION_PLANS = {
    "free": {
        "name": "無料プラン",
        "limits": {
            "max_reviews_per_month": 5,
            "max_short_answer_sessions_per_month": 10,
            "max_chat_messages_per_review": 0  # チャット機能なし
        },
        "features": ["review_generation", "short_answer"],
        "price_monthly": 0
    },
    "basic": {
        "name": "ベーシックプラン",
        "limits": {
            "max_reviews_per_month": 50,
            "max_short_answer_sessions_per_month": 100,
            "max_chat_messages_per_review": 10
        },
        "features": ["review_generation", "short_answer", "chat"],
        "price_monthly": 980
    },
    "premium": {
        "name": "プレミアムプラン",
        "limits": {
            "max_reviews_per_month": None,  # 無制限
            "max_short_answer_sessions_per_month": None,
            "max_chat_messages_per_review": None
        },
        "features": ["review_generation", "short_answer", "chat", "priority_support"],
        "price_monthly": 2980
    }
}

def get_plan_config(plan_code: str) -> dict:
    """プラン設定を取得"""
    return SUBSCRIPTION_PLANS.get(plan_code, SUBSCRIPTION_PLANS["free"])
```

## まとめ：改善版の利点

### ✅ 改善された点

1. **プラン変更履歴の追跡**
   - `user_subscriptions`テーブルで履歴を管理
   - いつ、どのプランに変更したかを追跡可能

2. **パフォーマンス向上**
   - `monthly_usage`テーブルで月次集計をキャッシュ
   - 使用量チェックが高速化

3. **柔軟性の向上**
   - プラン設定をJSON形式で管理
   - 新しい機能や制限を簡単に追加可能

4. **データ整合性**
   - 外部キー制約を適切に設定
   - インデックスを最適化

5. **拡張性**
   - 将来の決済システム統合に対応
   - 機能追加が容易

### 📊 テーブル構成の比較

| テーブル | v1 | v2 | 理由 |
|---------|----|----|------|
| `users` | ✅ | ✅ | 必須 |
| `subscription_plans` | ⚠️ | ✅ | DB管理で柔軟性向上 |
| `user_subscriptions` | ❌ | ✅ | 履歴管理のため必須 |
| `monthly_usage` | ❌ | ✅ | パフォーマンス向上のため推奨 |
| `usage_logs` | ⚠️ | ❌ | 冗長なので削除 |
| `user_sessions` | ⚠️ | ❌ | JWT使用時は不要 |

### 🎯 推奨実装

1. **Phase 1**: `users`, `subscription_plans`, `user_subscriptions`テーブルを作成
2. **Phase 2**: 既存テーブルに`user_id`を追加
3. **Phase 3**: 使用量チェック機能を実装（既存テーブルから集計）
4. **Phase 4**: `monthly_usage`テーブルを追加してパフォーマンス最適化
