# ユーザーに紐づく情報の整理と改善提案

## 現状の整理

### 1. Userモデル自体の情報

```python
class User(Base):
    # 基本情報
    id: int
    email: str
    name: str (nullable)
    
    # Google認証情報
    google_id: str (nullable)
    google_picture: str (nullable)
    
    # アカウント状態
    is_active: bool
    is_admin: bool
    
    # タイムスタンプ
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime (nullable)
    
    # ソフトデリート
    deleted_at: datetime (nullable)
```

### 2. 現在Userに紐づいているリレーションシップ

#### ✅ 定義済み
- `submissions`: Submission（答案提出）
- `short_answer_sessions`: ShortAnswerSession（短答式セッション）
- `notebooks`: Notebook（ノートブック）
- `subscriptions`: UserSubscription（課金プラン履歴）
- `monthly_usage`: MonthlyUsage（月次使用量）

#### ❌ 未定義（user_idは存在するがリレーションシップがない）
- `reviews`: Review（講評） - user_idはあるがrelationship未定義
- `threads`: Thread（チャットスレッド） - user_idはあるがrelationship未定義

### 3. 現在データベースに保存されていない情報

#### ダッシュボード情報（現在はlocalStorageのみ）
- 今日の目標（todayGoal）
- 集中メモ（focusMemo）
- 学習項目（studyItems）
- タイマー設定（timerEnabled）

#### ユーザー設定・プリファレンス
- UI設定（テーマ、言語など）
- 通知設定
- 表示設定

## 改善提案

### 提案1: リレーションシップの追加

#### ReviewモデルにUserリレーションシップを追加

**現状:**
```python
class Review(Base):
    user_id = Column(BigInteger, nullable=False, index=True)
    # relationship未定義
```

**改善後:**
```python
class Review(Base):
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user = relationship("User", back_populates="reviews")
```

#### ThreadモデルにUserリレーションシップを追加

**現状:**
```python
class Thread(Base):
    user_id = Column(Integer, nullable=False, index=True)
    # relationship未定義
```

**改善後:**
```python
class Thread(Base):
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user = relationship("User", back_populates="threads")
```

### 提案2: ユーザー設定・プリファレンステーブルの追加

```python
class UserPreference(Base):
    """ユーザー設定・プリファレンス"""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # UI設定
    theme = Column(String(20), default="light")  # "light", "dark", "auto"
    language = Column(String(10), default="ja")  # "ja", "en"
    
    # 通知設定
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=False)
    
    # 表示設定
    items_per_page = Column(Integer, default=20)
    default_view = Column(String(20), default="list")  # "list", "grid"
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="preference", uselist=False)
    
    __table_args__ = (
        Index('idx_user_preferences', 'user_id'),
    )
```

### 提案3: ダッシュボード情報テーブルの追加

```python
class UserDashboard(Base):
    """ユーザーのダッシュボード情報"""
    __tablename__ = "user_dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # 今日の目標
    today_goal = Column(Text, nullable=True)
    
    # 集中メモ
    focus_memo = Column(Text, nullable=True)
    
    # 学習項目
    study_items = Column(Text, nullable=True)  # JSON配列として保存可能
    
    # タイマー設定
    timer_enabled = Column(Boolean, default=False)
    timer_elapsed_seconds = Column(Integer, default=0)  # 累計学習時間（秒）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="dashboard", uselist=False)
    
    __table_args__ = (
        Index('idx_user_dashboard', 'user_id'),
    )
```

### 提案4: Userモデルの更新

```python
class User(Base):
    # ... 既存のフィールド ...
    
    # リレーションシップ（追加・修正）
    subscriptions = relationship("UserSubscription", back_populates="user", order_by="desc(UserSubscription.started_at)")
    submissions = relationship("Submission", back_populates="user")
    short_answer_sessions = relationship("ShortAnswerSession", back_populates="user")
    monthly_usage = relationship("MonthlyUsage", back_populates="user")
    notebooks = relationship("Notebook", back_populates="user")
    
    # 追加: リレーションシップ
    reviews = relationship("Review", back_populates="user", order_by="desc(Review.created_at)")
    threads = relationship("Thread", back_populates="user", order_by="desc(Thread.last_message_at)")
    preference = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    dashboard = relationship("UserDashboard", back_populates="user", uselist=False, cascade="all, delete-orphan")
```

## 実装優先順位

### Phase 1: リレーションシップの追加（高優先度）
1. ReviewモデルにUserリレーションシップを追加
2. ThreadモデルにUserリレーションシップを追加
3. Userモデルにリレーションシップを追加

**理由:** データ整合性の向上、クエリの簡素化

### Phase 2: ダッシュボード情報の永続化（中優先度）
1. UserDashboardテーブルの作成
2. ダッシュボード情報の保存・取得API
3. フロントエンドの統合

**理由:** ユーザー体験の向上、データの永続化

### Phase 3: ユーザー設定の追加（低優先度）
1. UserPreferenceテーブルの作成
2. 設定管理API
3. UI設定の実装

**理由:** 将来的な拡張性、カスタマイズ性の向上

## データ整合性の改善

### 外部キー制約の追加

**現状の問題:**
- Review.user_id: ForeignKey未定義
- Thread.user_id: ForeignKey未定義

**改善後:**
- すべてのuser_idにForeignKey制約を追加
- ondelete動作を適切に設定（CASCADE or SET NULL）

### インデックスの最適化

**推奨インデックス:**
- `(user_id, created_at)` - 時系列ソート用
- `(user_id, type)` - タイプ別フィルタ用
- `(user_id, is_active)` - アクティブなもののみ取得用

## まとめ

### 現状の問題点
1. ReviewとThreadにUserリレーションシップが未定義
2. ダッシュボード情報がデータベースに保存されていない
3. ユーザー設定・プリファレンスの管理がない

### 改善の効果
1. データ整合性の向上（外部キー制約）
2. クエリの簡素化（リレーションシップ利用）
3. ユーザー体験の向上（データの永続化）
4. 将来の拡張性（設定管理の基盤）
