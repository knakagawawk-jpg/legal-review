# データ設計提案：講評とダッシュボードの管理

## 📊 設計方針

### 1. 講評テーブルの設計

#### Reviewテーブル（全体の講評DB）
- **目的**: すべての講評を保存（共有可能、作成者情報も保持）
- **user_id**: 保持する（作成者を記録）
- **データ**: 完全な講評情報（問題、答案、講評結果JSON）

#### UserReviewHistoryテーブル（ユーザー利用履歴）
- **目的**: ユーザーが利用した講評の履歴を簡易情報として保存
- **review_id**: Reviewテーブルへの外部キー
- **データ**: 簡易情報（何をいつやったか、点数など）
- **重複保存**: Reviewテーブルと重複して保存（パフォーマンスと履歴管理のため）

#### データフロー

```
講評作成時:
1. ReviewテーブルにInsert（完全な講評情報）
2. UserReviewHistoryテーブルにInsert（簡易情報）

マイページ表示:
- UserReviewHistoryから一覧取得（軽量）
- 詳細表示時はReviewテーブルから再度クエリ
```

### 2. ダッシュボードテーブルの設計

#### UserDashboardテーブル（現在のダッシュボード）
- **目的**: リアルタイム編集用の現在のダッシュボード情報
- **保存場所**: DB + localStorage（一時保存）
- **更新**: ユーザーが編集するたびに更新

#### UserDashboardHistoryテーブル（日次履歴）
- **目的**: 毎朝4時に自動保存される日次履歴
- **date**: JST基準の日付（"2024-01-15"形式）
- **データ**: その日の目標、メモ、学習時間など

#### データフロー

```
リアルタイム編集:
1. localStorageに保存（即座に反映）
2. DBのUserDashboardテーブルに保存（永続化）

毎朝4時のバッチ処理:
1. UserDashboardテーブルから現在の情報を取得
2. UserDashboardHistoryテーブルに日次履歴としてInsert
3. UserDashboardテーブルをリセット（または保持）
```

## 🎯 テーブル設計の詳細

### Reviewテーブル（修正版）

```python
class Review(Base):
    """全体の講評DB（作成者情報も保持）"""
    __tablename__ = "reviews"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)  # 作成者（NULL可で共有講評も可能）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 問題の種類と参照
    source_type = Column(String(10), nullable=False)  # 'official' or 'custom'
    official_question_id = Column(BigInteger, ForeignKey("official_questions.id", ondelete="SET NULL"), nullable=True, index=True)
    custom_question_text = Column(Text, nullable=True)
    
    # ユーザー答案
    answer_text = Column(Text, nullable=False)
    
    # LLMの出力結果（JSONB形式）
    kouhyo_kekka = Column(JSONB, nullable=False) if hasattr(JSONB, '__init__') else Column(Text, nullable=False)
    
    # チャット機能
    thread_id = Column(Integer, ForeignKey("threads.id", ondelete="SET NULL"), nullable=True, index=True)
    has_chat = Column(Boolean, nullable=False, default=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="reviews")  # 作成者
    official_question = relationship("OfficialQuestion", foreign_keys=[official_question_id], back_populates="reviews")
    thread = relationship("Thread", foreign_keys=[thread_id], back_populates="reviews")
    user_history = relationship("UserReviewHistory", back_populates="review")  # 利用履歴
```

### UserReviewHistoryテーブル（修正版）

```python
class UserReviewHistory(Base):
    """ユーザーの講評利用履歴（簡易情報）"""
    __tablename__ = "user_review_history"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    review_id = Column(BigInteger, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 簡易情報（マイページ表示用）
    subject = Column(String(50), nullable=True)  # 科目（検索・フィルタ用）
    exam_type = Column(String(20), nullable=True)  # 試験種別（"司法試験" or "予備試験"）
    year = Column(Integer, nullable=True)  # 年度
    score = Column(Numeric(5, 2), nullable=True)  # 点数（講評結果から抽出）
    score_breakdown = Column(Text, nullable=True)  # 点数内訳（JSON形式、簡易版）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="review_history")
    review = relationship("Review", back_populates="user_history")
    
    __table_args__ = (
        Index('idx_user_review_history_created', 'user_id', 'created_at'),
        Index('idx_user_review_history_review', 'review_id'),
        Index('idx_user_review_history_subject', 'user_id', 'subject', 'created_at'),
    )
```

### UserDashboardテーブル（現在の設計）

```python
class UserDashboard(Base):
    """ユーザーの現在のダッシュボード情報（リアルタイム編集用）"""
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
    timer_enabled = Column(Boolean, default=False, nullable=False)
    timer_elapsed_seconds = Column(Integer, default=0, nullable=False)  # 累計学習時間（秒）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="dashboard", uselist=False)
```

### UserDashboardHistoryテーブル（現在の設計）

```python
class UserDashboardHistory(Base):
    """ユーザーのダッシュボード情報の日次履歴（毎朝4時に自動保存）"""
    __tablename__ = "user_dashboard_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 日付（JST基準、YYYY-MM-DD形式）
    date = Column(String(10), nullable=False)  # "2024-01-15"形式
    
    # その日の目標
    today_goal = Column(Text, nullable=True)
    
    # 集中メモ
    focus_memo = Column(Text, nullable=True)
    
    # 学習項目
    study_items = Column(Text, nullable=True)  # JSON配列として保存可能
    
    # タイマー情報
    timer_elapsed_seconds = Column(Integer, default=0, nullable=False)  # その日の累計学習時間（秒）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="dashboard_history")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_user_dashboard_date'),
        Index('idx_user_dashboard_history_date', 'user_id', 'date'),
    )
```

## 🔄 データフロー詳細

### 講評作成時のフロー

```
1. ユーザーが講評をリクエスト
   ↓
2. ReviewテーブルにInsert
   - user_id: 作成者
   - 完全な講評情報（問題、答案、講評結果JSON）
   ↓
3. UserReviewHistoryテーブルにInsert
   - user_id: 利用者（作成者と同じ）
   - review_id: ReviewテーブルのID
   - 簡易情報（科目、試験種別、年度、点数など）
```

### マイページ表示時のフロー

```
1. UserReviewHistoryから一覧取得
   - クエリ: WHERE user_id = ? ORDER BY created_at DESC
   - 取得データ: 科目、試験種別、年度、点数、作成日時
   ↓
2. ユーザーが詳細をクリック
   ↓
3. Reviewテーブルから詳細取得
   - クエリ: WHERE id = ? (review_id)
   - 取得データ: 完全な講評情報
```

### ダッシュボード編集時のフロー

```
1. ユーザーがダッシュボードを編集
   ↓
2. localStorageに保存（即座に反映）
   ↓
3. DBのUserDashboardテーブルに保存（永続化）
   - PUT /v1/users/me/dashboard
```

### 毎朝4時のバッチ処理フロー

```
1. バッチ処理が実行（cron jobなど）
   ↓
2. すべてのユーザーのUserDashboardテーブルを取得
   ↓
3. 各ユーザーについて:
   - 現在の日付（JST）を取得
   - UserDashboardHistoryにInsert
   - UserDashboardテーブルはリセット（または保持）
```

## 💡 設計の利点

### 1. パフォーマンス
- **マイページ一覧**: UserReviewHistoryから軽量データのみ取得（高速）
- **詳細表示**: 必要な時だけReviewテーブルから取得（オンデマンド）

### 2. データ整合性
- Reviewテーブルにuser_idを保持（作成者情報を記録）
- UserReviewHistoryで利用履歴を管理（重複保存だが、簡易情報のみ）

### 3. 拡張性
- 共有講評機能: Reviewテーブルのuser_idがNULLでも共有可能
- 履歴管理: UserReviewHistoryでユーザーの利用履歴を追跡

### 4. データ保持
- Reviewテーブル: 完全な講評情報を永続化
- UserReviewHistory: 簡易情報を重複保存（履歴管理とパフォーマンス）

## 📋 実装時の注意点

### Reviewテーブルのuser_id
- **nullable=True**: 共有講評も可能（将来的な拡張）
- **ondelete="SET NULL"**: ユーザー削除時はNULLに（講評は保持）

### UserReviewHistoryの簡易情報
- **score**: 講評結果JSONから抽出して保存
- **subject, exam_type, year**: 検索・フィルタ用に保存
- **score_breakdown**: 簡易版の点数内訳（JSON形式）

### ダッシュボードの保存戦略
- **localStorage**: 即座に反映（オフライン対応）
- **DB**: 永続化（デバイス間で共有）
- **日次履歴**: 毎朝4時に自動保存

## 🎯 まとめ

この設計により：
1. ✅ Reviewテーブルにuser_idを保持（作成者情報）
2. ✅ UserReviewHistoryで利用履歴を重複保存（簡易情報）
3. ✅ マイページは軽量データで高速表示
4. ✅ 詳細表示時はReviewテーブルから再取得
5. ✅ ダッシュボードはリアルタイム編集 + 日次履歴保存

すべての要件を満たす設計になっています。
