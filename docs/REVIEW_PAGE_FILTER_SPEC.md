# 講評生成ページのフィルター仕様

## 概要

講評生成ページ（`/review`）の年度・科目選択の想定挙動を整理したドキュメントです。

---

## 1. 年度選択の仕様

### 1-1. データ取得元

- **テーブル**: `problem_metadata`（優先）または `problems`（後方互換性）
- **エンドポイント**: `GET /v1/problems/years`
- **API Route Handler**: `GET /api/problems/years`

### 1-2. 取得方法

1. **`problem_metadata`テーブルから取得**（優先）

   ```sql
   SELECT DISTINCT year FROM problem_metadata ORDER BY year DESC
   ```

2. **データがない場合**（後方互換性）
   ```sql
   SELECT DISTINCT year FROM problems ORDER BY year DESC
   ```

### 1-3. 表示仕様

- **選択肢**: DB から取得した年度のリスト
- **表示形式**: 元号表記（例: "令和 7 年", "平成 30 年"）
  - 2019 年以降: 令和（2019 年 = 令和 1 年）
  - 1989 年〜2018 年: 平成（1989 年 = 平成 1 年）
  - 1926 年〜1988 年: 昭和（1926 年 = 昭和 1 年）
  - それ以前: 西暦（例: "1925 年"）
- **並び順**: 降順（新しい年度が上）
- **デフォルト**: 「すべて」（空文字列）

### 1-4. データがない場合の処理

- **選択肢**: 「すべて」のみ表示
- **エラー表示**: なし（空のリストとして扱う）
- **ユーザーへの通知**: なし（データがない場合は新規入力を促す）

---

## 2. 科目選択の仕様

### 2-1. データ取得元（初期表示時）

- **テーブル**: `problem_metadata`（優先）または `problems`（後方互換性）
- **エンドポイント**: `GET /v1/problems/subjects`
- **API Route Handler**: `GET /api/problems/subjects`

### 2-2. 取得方法（初期表示時）

1. **`problem_metadata`テーブルから取得**（優先）

   ```sql
   SELECT DISTINCT subject FROM problem_metadata ORDER BY subject ASC
   ```

2. **データがない場合**（後方互換性）
   ```sql
   SELECT DISTINCT subject FROM problems ORDER BY subject ASC
   ```

### 2-3. 表示仕様（初期表示時）

- **選択肢**: DB から取得した科目のリスト（全科目）
- **並び順**: 固定順序（憲法 → 国際関係法（私法系）の順、`FIXED_SUBJECTS`に従う）
  - 1. 憲法
  - 2. 行政法
  - 3. 民法
  - 4. 商法
  - 5. 民事訴訟法
  - 6. 刑法
  - 7. 刑事訴訟法
  - 8. 実務基礎（民事）
  - 9. 実務基礎（刑事）
  - 10. 倒産法
  - 11. 租税法
  - 12. 経済法
  - 13. 知的財産法
  - 14. 労働法
  - 15. 環境法
  - 16. 国際関係法（公法系）
  - 17. 国際関係法（私法系）
  - 18. 一般教養科目
- **デフォルト**: 「すべて」（空文字列）

### 2-4. 動的フィルタリング（将来的な改善案）

**注意**: 現在の実装では、年度や試験種別を選択しても科目リストは更新されません。将来的には以下の改善が考えられます：

- **選択された年度・試験種別に関連する科目のみ表示**
  - エンドポイント: `GET /v1/problems/subjects?exam_type=司法試験&year=2025`
  - クエリ: `SELECT DISTINCT subject FROM problem_metadata WHERE exam_type = ? AND year = ?`

**現状**: この機能は実装されていません。すべての科目を表示します。

### 2-5. データがない場合の処理

- **選択肢**: 「すべて」のみ表示
- **エラー表示**: なし（空のリストとして扱う）
- **ユーザーへの通知**: なし（データがない場合は新規入力を促す）

---

## 3. 問題メタデータの取得仕様

### 3-1. データ取得元

- **テーブル**: `problem_metadata`
- **エンドポイント**: `GET /v1/problems/metadata?exam_type=...&year=...&subject=...`
- **API Route Handler**: `GET /api/problems/metadata`

### 3-2. 取得条件

- **試験種別**（`exam_type`）: 必須ではない（空文字列の場合はフィルタリングしない）
- **年度**（`year`）: 必須ではない（`null`の場合はフィルタリングしない）
- **科目**（`subject`）: 必須ではない（空文字列の場合はフィルタリングしない）

### 3-3. クエリ例

```sql
SELECT * FROM problem_metadata
WHERE
  (exam_type = ? OR ? IS NULL OR ? = '')
  AND (year = ? OR ? IS NULL)
  AND (subject = ? OR ? = '' OR ? IS NULL)
ORDER BY year DESC, subject ASC
```

### 3-4. データがない場合の処理

- **結果**: 空のリスト
- **表示**: 「該当する問題が見つかりませんでした」
- **エラー**: なし（正常な状態として扱う）

---

## 4. 現在の問題点

### 4-1. 年度選択

**問題**: 「すべて」しか表示されない

**考えられる原因**:

1. API Route Handler が正しく動作していない
2. FastAPI のエンドポイントが正しく動作していない
3. データベースにデータがない
4. フロントエンドで API レスポンスを正しく処理していない

**確認すべき点**:

- `years` state が空の配列になっていないか
- API レスポンスの形式が正しいか（`{ years: [2025, 2024, ...] }`）
- エラーログが出力されていないか

### 4-2. 科目選択

**問題**: 「すべて」しか表示されない

**考えられる原因**:

1. API Route Handler が正しく動作していない
2. FastAPI のエンドポイントが正しく動作していない
3. データベースにデータがない
4. フロントエンドで API レスポンスを正しく処理していない

**確認すべき点**:

- `subjects` state が空の配列になっていないか
- API レスポンスの形式が正しいか（`{ subjects: ["憲法", "行政法", ...] }`）
- エラーログが出力されていないか

---

## 5. 想定挙動（完全版）

### 5-1. ページ読み込み時

1. **年度一覧を取得**

   - `GET /api/problems/years` を呼び出し
   - レスポンス: `{ years: [2025, 2024, 2023, ...] }`
   - 選択肢に表示: 「すべて」+ 取得した年度を元号表記で表示

2. **科目一覧を取得**
   - `GET /api/problems/subjects` を呼び出し
   - レスポンス: `{ subjects: ["憲法", "行政法", "民法", ...] }`
   - 選択肢に表示: 「すべて」+ 取得した科目を表示

### 5-2. フィルター選択時

1. **試験種別を選択**

   - 選択された値が `examType` state に保存される
   - 問題メタデータの取得がトリガーされる

2. **年度を選択**

   - 選択された値が `year` state に保存される
   - 問題メタデータの取得がトリガーされる

3. **科目を選択**

   - 選択された値が `subject` state に保存される
   - 問題メタデータの取得がトリガーされる

4. **問題メタデータの取得**
   - 3 つのフィルター条件を組み合わせて `GET /api/problems/metadata` を呼び出し
   - レスポンス: `{ metadata_list: [...] }`
   - 問題リストに表示

### 5-3. データがない場合

1. **年度データがない**

   - 選択肢: 「すべて」のみ
   - ユーザーは新規入力モードを使用する必要がある

2. **科目データがない**

   - 選択肢: 「すべて」のみ
   - ユーザーは新規入力モードを使用する必要がある

3. **問題メタデータがない**
   - メッセージ: 「該当する問題が見つかりませんでした」
   - ユーザーはフィルター条件を変更するか、新規入力モードを使用する

---

## 6. 確認手順

### 6-1. データベースの確認

```sql
-- 年度データの確認
SELECT DISTINCT year FROM problem_metadata ORDER BY year DESC;

-- 科目データの確認
SELECT DISTINCT subject FROM problem_metadata ORDER BY subject ASC;

-- データの件数確認
SELECT COUNT(*) FROM problem_metadata;
```

### 6-2. API の確認

```bash
# 年度一覧の取得
curl http://localhost:8000/v1/problems/years

# 科目一覧の取得
curl http://localhost:8000/v1/problems/subjects
```

### 6-3. フロントエンドの確認

1. ブラウザの開発者ツールを開く
2. Network タブを確認
3. `/api/problems/years` と `/api/problems/subjects` のレスポンスを確認
4. Console タブでエラーを確認

---

## 7. まとめ

### 現在の実装

- ✅ 年度選択: DB から取得（`problem_metadata.year`）
- ✅ 科目選択: DB から取得（`problem_metadata.subject`）
- ✅ 表示形式: 年度は元号表記、科目はそのまま
- ⚠️ 動的フィルタリング: 未実装（すべての科目を表示）

### 問題点

- ❌ 年度選択に「すべて」しか表示されない
- ❌ 科目選択に「すべて」しか表示されない

### 次のステップ

1. API Route Handler の動作確認
2. FastAPI エンドポイントの動作確認
3. データベースのデータ確認
4. フロントエンドのエラーハンドリング確認
