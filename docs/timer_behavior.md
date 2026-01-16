# タイマー機能の動作仕様と DB 操作フロー

## 概要

タイマー機能は、学習時間を記録・集計する機能です。以下の特徴があります：

- **4:00 境界**: 1 日の開始は 4:00 AM（ユーザータイムゾーン基準）
- **リアルタイム表示**: 実行中のセッションは DB に保存せず、クライアント側で計算
- **複数デバイス対応**: 新しいデバイスで開始すると、既存の running セッションは自動停止
- **秒単位管理**: すべての時間は秒で保存し、分は表示時に切り捨て計算

## データモデル

### 1. `timer_sessions`（セッションログ）

```sql
- id: UUID (PK)
- user_id: BIGINT (FK → users.id)
- device_id: VARCHAR(255) (NULL可)
- started_at_utc: TIMESTAMP WITH TIME ZONE
- ended_at_utc: TIMESTAMP WITH TIME ZONE (NULL可、running中はNULL)
- status: VARCHAR(20) ('running' | 'stopped')
- stop_reason: VARCHAR(50) (NULL可、'user_stop' | 'auto_replaced_by_new_start')
- created_at_utc: TIMESTAMP WITH TIME ZONE
- updated_at_utc: TIMESTAMP WITH TIME ZONE
```

**役割**: タイマーの ON/OFF の生ログ。1 回の ON/OFF が 1 レコード。

### 2. `timer_daily_chunks`（日次内訳）

```sql
- id: UUID (PK)
- user_id: BIGINT (FK → users.id)
- session_id: UUID (FK → timer_sessions.id)
- study_date: VARCHAR(10) ('YYYY-MM-DD')
- seconds: INTEGER
- created_at_utc: TIMESTAMP WITH TIME ZONE
```

**役割**: セッションを 4:00 境界で分割した結果。1 セッションが 4:00 を跨ぐと複数レコードになる。

### 3. `timer_daily_stats`（日次統計キャッシュ）

```sql
- user_id: BIGINT (PK, FK → users.id)
- study_date: VARCHAR(10) (PK, 'YYYY-MM-DD')
- total_seconds: INTEGER (確定分の合計秒)
- sessions_count: INTEGER (その日のセッション数)
- updated_at_utc: TIMESTAMP WITH TIME ZONE
```

**役割**: 高速表示用の集計キャッシュ。`timer_daily_chunks`から集計した結果を保持。

## API エンドポイントと処理フロー

### 1. POST `/api/timer/start` - タイマー開始

#### 処理フロー

```
1. 現在時刻を取得（UTC）
2. study_dateを計算（4:00境界）
3. 既存のrunningセッションを検索
   ├─ 存在する場合:
   │  ├─ ended_at_utc = now_utc
   │  ├─ status = 'stopped'
   │  ├─ stop_reason = 'auto_replaced_by_new_start'
   │  ├─ updated_at_utc = now_utc
   │  ├─ split_session_by_date_boundary()で分割
   │  ├─ 各chunkに対して:
   │  │  ├─ TimerDailyChunkをINSERT
   │  │  └─ update_daily_stats()で統計を更新
   │  └─ COMMIT
   │
4. 新しいセッションを作成
   ├─ id = UUID生成
   ├─ user_id = current_user.id
   ├─ device_id = リクエストパラメータ
   ├─ started_at_utc = now_utc
   ├─ status = 'running'
   ├─ ended_at_utc = NULL
   └─ INSERT → COMMIT

5. レスポンス生成
   ├─ active_session_id
   ├─ study_date
   ├─ confirmed_total_seconds (timer_daily_stats.total_seconds)
   ├─ active_started_at_utc
   ├─ daily_stats
   └─ sessions (今日のセッション一覧、最大5件)
```

#### DB 操作の詳細

**INSERT 操作**:

- `timer_sessions`: 1 件（新しい running セッション）
- `timer_daily_chunks`: 既存 running セッションがある場合、そのセッションの分割数分（通常 1-2 件）

**UPDATE 操作**:

- `timer_sessions`: 既存 running セッションがある場合、1 件
- `timer_daily_stats`: 既存 running セッションの chunks 分（各 study_date ごとに 1 件、存在しない場合は INSERT）

**注意点**:

- 既存 running セッションを停止する際、`sessions_count`は更新されない（`update_daily_stats`の`additional_sessions=0`）
- これは仕様として正しい（自動停止は新しいセッション開始の副作用）

### 2. POST `/api/timer/stop/{session_id}` - タイマー停止

#### 処理フロー

```
1. セッションを検索・検証
   ├─ session_idとuser_idで検索
   ├─ 存在しない → 404
   └─ status != 'running' → 400

2. 現在時刻を取得（UTC）
3. study_dateを計算（4:00境界）

4. セッションを停止
   ├─ ended_at_utc = now_utc
   ├─ status = 'stopped'
   ├─ stop_reason = 'user_stop'
   └─ updated_at_utc = now_utc

5. セッションを4:00境界で分割
   └─ split_session_by_date_boundary(started_at_utc, ended_at_utc)

6. 各chunkに対して:
   ├─ TimerDailyChunkをINSERT
   └─ update_daily_stats()で統計を更新
      ├─ additional_seconds = chunk_seconds
      └─ additional_sessions = 1 (chunk_study_date == study_dateの場合のみ)
         ※ これは不正確。最後のchunkだけが1になる

7. COMMIT

8. レスポンス生成
   ├─ stopped_session_id
   ├─ study_date
   ├─ confirmed_total_seconds
   ├─ daily_stats
   └─ sessions (今日のセッション一覧、最大5件)
```

#### DB 操作の詳細

**INSERT 操作**:

- `timer_daily_chunks`: セッションの分割数分（通常 1-2 件）

**UPDATE 操作**:

- `timer_sessions`: 1 件（停止したセッション）
- `timer_daily_stats`: chunks 分（各 study_date ごとに 1 件、存在しない場合は INSERT）

**修正済み**:

- セッション開始時刻から`study_date`を計算し、セッション全体の`sessions_count`を更新
- セッションが 4:00 を跨ぐ場合でも、1 セッションとして正しくカウントされる

### 3. GET `/api/timer/daily-stats` - 日次統計取得

#### 処理フロー

```
1. study_dateを決定
   ├─ リクエストパラメータがあればそれを使用
   └─ なければ現在時刻から計算

2. timer_daily_statsを検索
   ├─ 存在する → そのまま返す
   └─ 存在しない → 新規作成（total_seconds=0, sessions_count=0）して返す
```

#### DB 操作の詳細

**SELECT 操作**:

- `timer_daily_stats`: 1 件

**INSERT 操作**:

- 存在しない場合のみ、`timer_daily_stats`: 1 件

### 4. GET `/api/timer/sessions` - セッション一覧取得

#### 処理フロー

```
1. study_dateを決定
   ├─ リクエストパラメータがあればそれを使用
   └─ なければ現在時刻から計算

2. 今日のセッションを取得
   ├─ timer_sessionsとtimer_daily_chunksをJOIN
   ├─ timer_daily_chunks.study_date == study_dateでフィルタ
   ├─ DISTINCTで重複除去
   ├─ started_at_utc DESCでソート
   └─ LIMITで件数制限

3. runningセッションも含める
   ├─ status='running'のセッションを検索
   ├─ 各runningセッションのstudy_dateを計算
   ├─ study_dateが一致し、かつ上記のリストに含まれていない場合、先頭に追加
   └─ LIMITで件数制限

4. レスポンス生成
   └─ TimerSessionResponseのリスト
```

#### DB 操作の詳細

**SELECT 操作**:

- `timer_sessions` + `timer_daily_chunks`: JOIN クエリ
- `timer_sessions`: running セッション検索

## 4:00 境界の処理

### `get_study_date()`関数

```python
def get_study_date(date: datetime = None) -> str:
    """
    4:00境界で学習日を計算

    ルール:
    - UTC時刻をユーザーTZ（Asia/Tokyo）に変換
    - ローカル時刻が4:00未満 → 前日がstudy_date
    - ローカル時刻が4:00以降 → 当日がstudy_date

    例:
    - 2024-01-01 03:00 JST → study_date = '2023-12-31'
    - 2024-01-01 04:00 JST → study_date = '2024-01-01'
    - 2024-01-01 23:59 JST → study_date = '2024-01-01'
    """
```

### `split_session_by_date_boundary()`関数

```python
def split_session_by_date_boundary(started_at_utc: datetime, ended_at_utc: datetime) -> List[tuple]:
    """
    セッションを4:00境界で分割

    戻り値:
    List[tuple]: [(study_date, chunk_start_utc, chunk_end_utc, seconds), ...]

    例:
    - 開始: 2024-01-01 02:00 JST (2024-01-01 17:00 UTC)
    - 終了: 2024-01-01 05:00 JST (2024-01-01 20:00 UTC)
    - 結果:
      [
        ('2023-12-31', 2024-01-01 17:00 UTC, 2024-01-01 19:00 UTC, 7200),  # 2時間
        ('2024-01-01', 2024-01-01 19:00 UTC, 2024-01-01 20:00 UTC, 3600),  # 1時間
      ]
    """
```

## リアルタイム表示の仕組み

### クライアント側の計算

```typescript
// 確定済みの秒数（DBから取得）
const confirmedTotalSeconds = timerDailyStats.total_seconds;

// 実行中の秒数（クライアント側で計算）
const calculateRunningSeconds = (): number => {
  if (!timerEnabled || !activeSessionStartTime) return 0;

  const now = new Date();
  const studyDate = getStudyDate();
  const todayStart = new Date(`${studyDate}T04:00:00+09:00`); // JST 4:00 AM
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const sessionStart = activeSessionStartTime;
  const sessionEnd = now;

  // 今日の範囲との重複部分を計算
  const overlapStart = sessionStart > todayStart ? sessionStart : todayStart;
  const overlapEnd = sessionEnd < todayEnd ? sessionEnd : todayEnd;

  if (overlapStart >= overlapEnd) return 0;

  return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 1000);
};

// 表示用の合計秒数
const displayTotalSeconds = confirmedTotalSeconds + calculateRunningSeconds();

// 表示用の分（切り捨て）
const displayTotalMinutes = Math.floor(displayTotalSeconds / 60);
```

### 更新タイミング

- **DB 更新**: タイマー開始時・停止時のみ
- **表示更新**: クライアント側で 1 秒ごとに`calculateRunningSeconds()`を再計算
- **DB 書き込み**: 実行中は一切行わない（パフォーマンス考慮）

## データ整合性の保証

### 制約

1. **1 ユーザー 1running セッション**: `start_timer`で既存の running セッションを自動停止
2. **トランザクション**: セッション停止と chunks 作成は同一トランザクション内で実行
3. **外部キー制約**: `timer_daily_chunks.session_id` → `timer_sessions.id` (CASCADE DELETE)
4. **インデックス**: パフォーマンス向上のため、主要な検索条件にインデックスを設定

### 整合性チェック

- `timer_daily_stats.total_seconds` = `SUM(timer_daily_chunks.seconds WHERE study_date = X)` が成立する必要がある
- ただし、running セッションは chunk がまだ作成されていないため、一時的に不一致が発生する可能性がある

## 既知の問題点と改善案

### 問題 1: `stop_timer`での`additional_sessions`計算が不正確 ✅ 修正済み

**修正前の問題**:

```python
# 各chunkに対して、chunk_study_date == study_dateの場合のみsessions_countを増やす
update_daily_stats(db, current_user.id, chunk_study_date, chunk_seconds, 1 if chunk_study_date == study_date else 0)
```

セッションが 4:00 を跨ぐ場合、複数の chunk が作成されるが、`sessions_count`は最後の chunk（今日の study_date）の時だけ 1 増える。

**修正後**:

```python
# セッション開始時刻からstudy_dateを計算（セッションがどの日に属するか）
session_study_date = get_study_date(session.started_at_utc)

# セッション全体のsessions_countを更新（セッション開始日のstudy_dateが今日の場合のみ）
if session_study_date == study_date:
    update_daily_stats(db, current_user.id, study_date, 0, additional_sessions=1)

# 各chunkの秒数を更新（sessions_countは既に更新済み）
for chunk_study_date, chunk_start, chunk_end, chunk_seconds in chunks:
    # ... chunk作成 ...
    update_daily_stats(db, current_user.id, chunk_study_date, chunk_seconds, 0)
```

**改善点**:

- セッション開始時刻から`study_date`を計算することで、セッション全体がどの日に属するかを正確に判定
- セッションが 4:00 を跨ぐ場合でも、1 セッションとして正しくカウントされる
- `sessions_count`の更新と秒数の更新を分離することで、ロジックが明確になった

### 問題 2: `start_timer`で既存 running セッションを停止する際の`sessions_count`更新

**現状**: `additional_sessions=0`で更新しているため、自動停止されたセッションは`sessions_count`にカウントされない。

**判断**: これは仕様として正しい可能性がある。自動停止は新しいセッション開始の副作用であり、ユーザーが明示的に停止したわけではないため。

**改善案**: 仕様を明確化する。自動停止もカウントする場合は、`additional_sessions=1`に変更。

## まとめ

タイマー機能は以下の特徴を持ちます：

1. **4:00 境界**: 1 日の開始は 4:00 AM（ユーザータイムゾーン基準）
2. **リアルタイム表示**: 実行中のセッションは DB に保存せず、クライアント側で計算
3. **複数デバイス対応**: 新しいデバイスで開始すると、既存の running セッションは自動停止
4. **秒単位管理**: すべての時間は秒で保存し、分は表示時に切り捨て計算

DB 操作は主に以下のタイミングで発生します：

- **タイマー開始時**: `timer_sessions`に INSERT、既存 running セッションがあれば停止処理
- **タイマー停止時**: `timer_sessions`を UPDATE、`timer_daily_chunks`に INSERT、`timer_daily_stats`を UPDATE
- **統計取得時**: `timer_daily_stats`を SELECT（存在しない場合は INSERT）

既知の問題点として、`stop_timer`での`sessions_count`更新ロジックが不正確な可能性があります。改善が必要です。
