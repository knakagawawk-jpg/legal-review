# 科目管理設計書

## 現状の科目使用状況

### 1. データベースモデル（models.py）

#### ✅ 既にID管理されているテーブル
- **`OfficialQuestion`**: `subject_id` (Integer, ForeignKey) - ✅ 正しく実装済み
- **`ProblemMetadata`**: `subject_id` (Integer, ForeignKey) - ✅ 修正済み
- **`Submission`**: `subject_id` (Integer, ForeignKey) - ✅ 修正済み
- **`ShortAnswerProblem`**: `subject_id` (Integer, ForeignKey) - ✅ 修正済み
- **`ShortAnswerSession`**: `subject_id` (Integer, ForeignKey) - ✅ 修正済み
- **`UserReviewHistory`**: `subject_id` (Integer, ForeignKey) - ✅ 修正済み

#### ⚠️ 文字列で管理されているテーブル（後方互換性のため保持）
- **`Problem`**: `subject` (String(50)) - 旧形式、後方互換性のため保持

#### 📝 特殊なケース
- **`DashboardItem`**: `subject` (Integer, 1〜18) - これは科目IDではなく、科目番号（1=憲法、2=行政法など）として使用

### 2. APIスキーマ（schemas.py）

#### リクエストスキーマ
- `ProblemMetadataCreate`: `subject: str` - ⚠️ 修正必要
- `ProblemCreate`: `subject: str` - ⚠️ 後方互換性のため保持
- `ReviewRequest`: `subject: str` - ⚠️ 修正必要
- `ShortAnswerProblemCreate`: `subject: str` - ⚠️ 修正必要
- `ShortAnswerSessionCreate`: `subject: str` - ⚠️ 修正必要

#### レスポンススキーマ
- `ProblemMetadataResponse`: `subject: str` - ⚠️ 修正必要（IDから名前を取得して返す）
- `ProblemResponse`: `subject: str` - ⚠️ 後方互換性のため保持
- `ReviewResponse`: `subject: Optional[str]` - ⚠️ 修正必要（IDから名前を取得して返す）
- `ShortAnswerProblemResponse`: `subject: str` - ⚠️ 修正必要
- `ShortAnswerSessionResponse`: `subject: str` - ⚠️ 修正必要
- `UserReviewHistoryResponse`: `subject: Optional[str]` - ⚠️ 修正必要

### 3. APIエンドポイント（main.py）

#### 科目名を文字列で扱っている箇所

1. **問題一覧取得** (`GET /v1/problems`)
   - クエリパラメータ: `subject: Optional[str]`
   - フィルタ: `Problem.subject == subject`
   - ソート: `Problem.subject`

2. **問題メタデータ一覧取得** (`GET /v1/problems/metadata`)
   - クエリパラメータ: `subject: Optional[str]`
   - フィルタ: `ProblemMetadata.subject == subject`
   - ソート: `ProblemMetadata.subject`

3. **科目一覧取得** (`GET /v1/problems/subjects`)
   - 返却: `List[str]` (科目名のリスト)

4. **講評生成** (`POST /v1/review`)
   - リクエスト: `subject: str`
   - 処理: `subject = req.subject` または `subject = metadata.subject`
   - Submission保存: `subject=subject` (String)

5. **講評取得** (`GET /v1/reviews/{review_id}`)
   - 処理: `subject = official_q.subject.name` または `subject = history.subject`
   - 返却: `subject: Optional[str]`

6. **短答式問題一覧取得** (`GET /v1/short-answer/problems`)
   - クエリパラメータ: `subject: Optional[str]`
   - フィルタ: `ShortAnswerProblem.subject == subject`

7. **短答式セッション作成** (`POST /v1/short-answer/sessions`)
   - リクエスト: `subject: str`
   - 保存: `subject=session_data.subject` (String)

8. **講評履歴一覧取得** (`GET /v1/review-history`)
   - クエリパラメータ: `subject: Optional[str]`
   - フィルタ: `UserReviewHistory.subject == subject`

## 現在の管理方法の問題点

### 1. データの不整合リスク
- 科目名を文字列で保存しているため、タイポや表記ゆれが発生する可能性
- 科目名の変更時に全テーブルを更新する必要がある

### 2. ストレージの無駄
- 同じ科目名が複数のレコードに重複保存される

### 3. 検索・フィルタの非効率
- 文字列比較による検索は、ID比較より遅い

### 4. 一貫性の欠如
- `OfficialQuestion`は既にID管理されているが、他のテーブルは文字列管理
- 同じ科目を参照するのに方法が異なる

## 改善提案

### 方針
**すべてのテーブルで科目をID管理に統一し、表示時のみ科目名に変換**

### 実装方針

#### 1. データベースモデル
- ✅ 既に修正済み（`subject_id`に統一）
- ⚠️ `Problem`テーブルは後方互換性のため文字列のまま保持

#### 2. APIスキーマ
- **リクエスト**: `subject_id: int` または `subject_name: str`（名前からIDを解決）
- **レスポンス**: `subject: str`（IDから名前を取得して返す）

#### 3. APIエンドポイント
- 科目名を受け取る場合は、`Subject`テーブルからIDを解決
- レスポンスでは、`subject_id`から`Subject.name`を取得して返す

#### 4. マイグレーション
- 既存データの`subject`文字列を`subject_id`に変換するマイグレーションスクリプトが必要

### 実装の優先順位

1. **高優先度**
   - `ProblemMetadata` - 新しい問題管理の中心
   - `UserReviewHistory` - 講評履歴の表示に重要
   - `Submission` - 答案提出の記録

2. **中優先度**
   - `ShortAnswerProblem` - 短答式問題
   - `ShortAnswerSession` - 短答式セッション

3. **低優先度**
   - `Problem` - 後方互換性のため保持（段階的に廃止予定）

## 実装時の注意点

### 1. 後方互換性
- 既存のAPIエンドポイントは、科目名を受け取る場合はIDに変換
- レスポンスでは科目名を返す（既存のクライアントとの互換性）

### 2. エラーハンドリング
- 存在しない科目名が指定された場合のエラーハンドリング
- 存在しない科目IDが指定された場合のエラーハンドリング

### 3. パフォーマンス
- 科目名→IDの変換はキャッシュを検討
- レスポンス生成時のJOIN処理を最適化

### 4. マイグレーション
- 既存データの移行スクリプトを作成
- データ整合性チェックを実施

## 次のステップ

1. ✅ モデル定義の修正（完了）
2. ⏳ スキーマの修正
3. ⏳ APIエンドポイントの修正
4. ⏳ マイグレーションスクリプトの作成
5. ⏳ UI側の修正（科目名の表示）
