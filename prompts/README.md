# プロンプト構造

## ディレクトリ構造

```
prompts/
├── main/                    # メイン指示ページ
│   ├── input_processing.txt # ユーザー入力の処理（JSON変換）
│   └── evaluation.txt       # 生成したJSONの評価
└── subjects/               # 科目別変数ページ
    ├── constitution.txt    # 憲法
    ├── administrative_law.txt # 行政法
    ├── civil_law.txt       # 民法
    ├── civil_practice.txt  # 実務基礎（民事）
    ├── criminal_law.txt     # 刑法
    ├── criminal_practice.txt # 実務基礎（刑事）
    └── default.txt         # 一般科目（デフォルト）
```

## 使用方法

### 1. ユーザー入力の処理

`main/input_processing.txt` を読み込み、以下の変数を置換：
- `{SUBJECT_SPECIFIC_GUIDELINES}`: 科目別の留意事項（`subjects/{subject}.txt`から読み込み）
- `{QUESTION_TEXT}`: 問題文
- `{PURPOSE_TEXT}`: 出題趣旨（問題選択時に取得）
- `{ANSWER_TEXT}`: ユーザーが入力した答案

### 2. 生成したJSONの評価

`main/evaluation.txt` を読み込み、以下の変数を置換：
- `{SUBJECT_SPECIFIC_GUIDELINES}`: 科目別の留意事項
- `{PURPOSE_TEXT}`: 出題趣旨
- `{REVIEW_JSON}`: 1段階目で生成された講評JSON

## 科目名のマッピング

科目名からファイル名へのマッピング：
- "憲 法" / "憲法" → `constitution.txt`
- "行政法" → `administrative_law.txt`
- "民 法" / "民法" → `civil_law.txt`
- "商 法" / "商法" → `commercial_law.txt`（未作成、default.txtを使用）
- "民事訴訟法" → `civil_procedure.txt`（未作成、default.txtを使用）
- "刑 法" / "刑法" → `criminal_law.txt`
- "刑事訴訟法" → `criminal_procedure.txt`（未作成、default.txtを使用）
- "実務基礎（民事）" → `civil_practice.txt`
- "実務基礎（刑事）" → `criminal_practice.txt`
- その他 → `default.txt`

## 変数の置換

プロンプトファイル内の変数は以下のように置換されます：

- `{SUBJECT_SPECIFIC_GUIDELINES}`: 科目別の留意事項ファイルの内容
- `{QUESTION_TEXT}`: 問題文（存在する場合）
- `{PURPOSE_TEXT}`: 出題趣旨（問題選択時に取得）
- `{ANSWER_TEXT}`: ユーザーが入力した答案
- `{REVIEW_JSON}`: 生成された講評JSON（評価段階で使用）

## 注意事項

- すべての変数は適切にエスケープする必要があります
- JSON形式の出力を要求する場合、コードブロックで囲む必要はありません
- 科目別の留意事項ファイルが存在しない場合は、`default.txt`を使用します
