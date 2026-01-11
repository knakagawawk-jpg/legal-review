# システム全体レビュー：問題点・改善点・エラー要因の整理

## 更新日
2025年1月現在

## 確認した構成

### プロンプトファイル
- `input_processing.txt`: 答案をJSON形式に構造化（評価なし）
- `evaluation.txt`: 4ステップで評価を実行（1つのプロンプトファイル内）

### 実装コード
- `llm_service.py`: 2段階処理（JSON化→評価）
- `main.py`: FastAPIエンドポイント

---

## 🚨 重大な問題点（即座に対応が必要）

### 問題1: `_evaluate_json`関数で`question_text`が渡されていない

**問題の詳細**:
- `evaluation.txt`では`{QUESTION_TEXT}`が必要（Step 1で使用）
- `_evaluate_json`関数のシグネチャに`question_text`パラメータがない
- 変数置換でも`{QUESTION_TEXT}`が置換されていない

**影響範囲**:
- Step 1（出題趣旨を踏まえた問題文の理解）が正しく実行できない
- プロンプト内に`{QUESTION_TEXT}`がそのまま残り、LLMが混乱する可能性

**エラー発生箇所**:
```python
# llm_service.py 48行目
evaluation_result = _evaluate_json(client, subject, purpose_text, analysis_json)
# ↑ question_textが渡されていない

# llm_service.py 150-179行目
def _evaluate_json(
    client: Anthropic,
    subject: str,
    purpose_text: Optional[str],
    analysis_json: Dict[str, Any]
) -> Dict[str, Any]:
    # ...
    prompt = template.replace("{SUBJECT_SPECIFIC_GUIDELINES}", subject_guidelines)
    prompt = prompt.replace("{PURPOSE_TEXT}", purpose_text or "（出題趣旨なし）")
    prompt = prompt.replace("{REVIEW_JSON}", json.dumps(analysis_json, ensure_ascii=False, indent=2))
    # ↑ {QUESTION_TEXT}の置換がない
```

**修正方法**:
1. `_evaluate_json`関数のシグネチャに`question_text: Optional[str]`を追加
2. `generate_review`関数の呼び出し時に`question_text`を渡す
3. 変数置換で`{QUESTION_TEXT}`を置換する

**修正例**:
```python
def _evaluate_json(
    client: Anthropic,
    subject: str,
    question_text: Optional[str],  # 追加
    purpose_text: Optional[str],
    analysis_json: Dict[str, Any]
) -> Dict[str, Any]:
    # ...
    prompt = template.replace("{SUBJECT_SPECIFIC_GUIDELINES}", subject_guidelines)
    prompt = prompt.replace("{PURPOSE_TEXT}", purpose_text or "（出題趣旨なし）")
    prompt = prompt.replace("{QUESTION_TEXT}", question_text or "（問題文なし）")  # 追加
    prompt = prompt.replace("{REVIEW_JSON}", json.dumps(analysis_json, ensure_ascii=False, indent=2))
```

```python
# generate_review関数内
evaluation_result = _evaluate_json(
    client, subject, question_text, purpose_text, analysis_json  # question_textを追加
)
```

---

### 問題2: `evaluation.txt`の新しい構造（4ステップ）に対する実装対応が不足

**問題の詳細**:
- `evaluation.txt`は4ステップ構成（Step 1-4）だが、実装コードは古い構造を前提
- Step 1-3の出力は「頭の中で整理」となっているが、実際には出力が必要
- Step 4の出力形式が変更されている可能性

**影響範囲**:
- LLMが4ステップを正しく実行できない可能性
- 各ステップの出力が適切に処理されない可能性

**確認が必要な点**:
- `evaluation.txt`の各ステップが実際に実行されるか
- Step 1-3の出力が必要か、それとも「頭の中で整理」でよいか
- Step 4の最終出力形式が既存の`_format_markdown`や`_build_final_review`と互換性があるか

---

### 問題3: JSON構造の不一致の可能性

**問題の詳細**:
- `evaluation.txt`の出力形式（`overall_review`, `strengths`, `weaknesses`, `future_considerations`）
- `_format_markdown`関数が期待する形式
- `_build_final_review`関数が期待する形式

**確認が必要な点**:
- `evaluation.txt`の最終出力形式が既存コードと互換性があるか
- `strengths`と`weaknesses`が辞書形式（`category`, `description`）か、文字列リストか
- `_format_markdown`の651行目で`elem.get("implicit")`を参照しているが、`evaluation.txt`では`explicit`に変更されている

**潜在的なエラー**:
```python
# llm_service.py 661行目
status = "明示的" if not elem.get("implicit") else "暗黙的"
# ↑ input_processing.txtでは"explicit"に変更されているため、このロジックが正しく動作しない可能性
```

---

## ⚠️ 中程度の問題点（早急に対応推奨）

### 問題4: 変数置換の順序問題

**問題の詳細**:
- `{REVIEW_JSON}`の中に`{`や`}`が含まれるため、他の変数置換で問題が起きる可能性は低いが、理論的には問題あり得る

**現在の実装**:
```python
prompt = template.replace("{SUBJECT_SPECIFIC_GUIDELINES}", subject_guidelines)
prompt = prompt.replace("{PURPOSE_TEXT}", purpose_text or "（出題趣旨なし）")
prompt = prompt.replace("{REVIEW_JSON}", json.dumps(analysis_json, ensure_ascii=False, indent=2))
```

**改善案**:
- 変数置換の順序を最適化（JSONが最後）
- または、正規表現を使用したより安全な置換

---

### 問題5: 入力値の検証不足

**問題の詳細**:
- `question_text`, `purpose_text`が`None`の場合の処理はあるが、空文字列の場合の処理が不明確
- `answer_text`が空の場合の検証がない

**潜在的なエラー**:
- 空文字列の答案がLLMに送られると、エラーが発生する可能性

**改善案**:
```python
if not answer_text or not answer_text.strip():
    raise ValueError("答案が空です")
```

---

### 問題6: JSONパースエラーの詳細度が不十分

**問題の詳細**:
- JSONパースエラー時のエラーメッセージはあるが、LLMの出力が途中で切れている場合の検出が不十分
- `max_tokens`を超えた場合の検出がない

**改善案**:
- レスポンスが途中で切れている場合（最後が`}`で終わっていない）を検出
- `max_tokens`を超えた可能性を検出して警告

---

### 問題7: `_format_markdown`関数のフィールド名の不一致

**問題の詳細**:
- `input_processing.txt`では`explicit`フィールドを使用
- `_format_markdown`関数（651行目）では`implicit`フィールドを参照

**エラー発生箇所**:
```python
# llm_service.py 661行目
status = "明示的" if not elem.get("implicit") else "暗黙的"
# ↑ input_processing.txtでは"explicit"に変更されている
```

**修正方法**:
```python
status = "明示的" if elem.get("explicit", False) else "読み取れる形"
```

---

## 💡 改善提案（パフォーマンス・保守性）

### 改善1: トークン使用量の最適化

**現状**:
- `max_tokens`が16384に設定されている
- 実際の使用量をログに記録しているが、上限に達した場合の検出がない

**改善案**:
- レスポンスが`max_tokens`に達した場合を検出
- 必要に応じて`max_tokens`を動的に調整

---

### 改善2: エラーハンドリングの統一

**現状**:
- 各関数で個別にエラーハンドリングしている
- エラーメッセージの形式が統一されていない

**改善案**:
- カスタム例外クラスを作成
- エラーメッセージの形式を統一

---

### 改善3: ログ出力の改善

**現状**:
- `print`と`logging`が混在
- ログレベルの使い分けが不十分

**改善案**:
- `print`を`logging`に統一
- ログレベルを適切に設定（DEBUG, INFO, WARNING, ERROR）

---

### 改善4: プロンプト変数の検証

**現状**:
- プロンプト変数の置換漏れを検出する仕組みがない

**改善案**:
- プロンプト変数（`{XXX}`）が残っていないか検証する関数を追加
- 置換漏れを検出したら警告またはエラー

```python
def _validate_prompt_variables(prompt: str) -> List[str]:
    """プロンプトに残っている変数を検出"""
    import re
    remaining_vars = re.findall(r'\{[A-Z_]+\}', prompt)
    return remaining_vars
```

---

### 改善5: JSON構造のバリデーション

**現状**:
- JSONパースは成功するが、期待する構造かどうかの検証がない

**改善案**:
- PydanticモデルでJSON構造をバリデーション
- 必須フィールドの存在確認

---

### 改善6: `input_processing.txt`の`explicit`フィールドと`_format_markdown`の不一致

**現状**:
- `input_processing.txt`では`explicit: true/false`を使用
- `_format_markdown`では`implicit`フィールドを参照

**修正方法**:
- `_format_markdown`関数を修正して`explicit`フィールドを使用

---

## 🔍 エラーが発生しそうな箇所

### 1. 変数置換漏れによるエラー

**発生箇所**: `_evaluate_json`関数（179行目付近）
```python
# 問題: {QUESTION_TEXT}が置換されていない
prompt = template.replace("{QUESTION_TEXT}", ...)  # この行が存在しない
```

**発生確率**: **高**
**影響**: Step 1が正しく実行できない

---

### 2. フィールド名の不一致によるエラー

**発生箇所**: `_format_markdown`関数（661行目）
```python
# 問題: "implicit"フィールドが存在しない（"explicit"に変更されている）
status = "明示的" if not elem.get("implicit") else "暗黙的"
```

**発生確率**: **中**
**影響**: マークダウン表示で「暗黙的」が常に表示される

---

### 3. JSONパースエラー（構造の不一致）

**発生箇所**: `_evaluate_json`関数（219行目）
```python
return json.loads(content)
```

**発生確率**: **中**
**影響**: evaluation.txtの新しい出力形式が既存コードと互換性がない場合

**確認が必要**:
- `evaluation.txt`の最終出力が`overall_review`, `strengths`, `weaknesses`, `future_considerations`を含むか
- 各フィールドの形式が期待通りか

---

### 4. `max_tokens`超過エラー

**発生箇所**: Claude API呼び出し時
```python
message = client.messages.create(
    model=ANTHROPIC_MODEL,
    max_tokens=16384,  # これを超える可能性
    ...
)
```

**発生確率**: **低**（ただし、長い答案や詳細な評価の場合は可能性あり）
**影響**: レスポンスが途中で切れる可能性

**確認方法**:
- レスポンスの最後が`}`で終わっているか確認
- `usage.output_tokens`が`max_tokens`に近い値を検出

---

### 5. プロンプトファイル読み込みエラー

**発生箇所**: `_load_prompt_template`関数（471行目）
```python
template_path = PROMPTS_DIR / "main" / f"{template_name}.txt"
if not template_path.exists():
    raise FileNotFoundError(...)
```

**発生確率**: **低**
**影響**: プロンプトファイルが存在しない場合

---

## 📋 修正優先度

### 優先度1（即座に対応）:
1. ✅ **問題1**: `_evaluate_json`関数に`question_text`パラメータを追加
2. ✅ **問題7**: `_format_markdown`関数で`explicit`フィールドを使用

### 優先度2（早急に対応）:
3. ⚠️ **問題2**: `evaluation.txt`の新しい構造に対する実装対応の確認・修正
4. ⚠️ **問題3**: JSON構造の不一致の確認・修正

### 優先度3（計画的に対応）:
5. 💡 **改善1-6**: パフォーマンス・保守性の改善

---

## 🔧 推奨される修正手順

### Step 1: 緊急修正（問題1, 7）

1. `_evaluate_json`関数のシグネチャを修正
2. `question_text`の変数置換を追加
3. `_format_markdown`関数で`explicit`フィールドを使用

### Step 2: 構造確認（問題2, 3）

1. `evaluation.txt`の最終出力形式を確認
2. 既存コード（`_format_markdown`, `_build_final_review`）との互換性を確認
3. 必要に応じて修正

### Step 3: テスト

1. 各修正をテスト
2. エラーハンドリングを確認
3. ログ出力を確認

### Step 4: 改善

1. パフォーマンス改善
2. エラーハンドリングの統一
3. ログ出力の改善

---

## 📝 追加の確認事項

### 1. `evaluation.txt`の出力形式について

**質問**: Step 4の最終出力が既存のコードと互換性があるか？

**確認方法**:
- `_format_markdown`関数が`evaluation_result`から正しく情報を取得できるか
- `_build_final_review`関数が正しく動作するか

**推測される問題**:
- `evaluation_result`の構造が変わっている可能性
- `strengths`と`weaknesses`が辞書形式か、文字列リストか

### 2. プロンプトの実行順序について

**質問**: LLMが4ステップを正しく順次実行するか？

**確認方法**:
- 実際のLLMレスポンスを確認
- 各ステップが適切に実行されているか検証

**懸念事項**:
- LLMがステップを飛ばす可能性
- ステップの順序が入れ替わる可能性

### 3. トークン使用量について

**質問**: 4ステップを1つのプロンプトで実行する場合、トークン使用量は増えるか？

**確認方法**:
- 実際のトークン使用量をログで確認
- `max_tokens`を超える可能性を評価

**推測**:
- プロンプトが長くなるため、入力トークンは増える
- 出力トークンは4ステップ分になるため、増える可能性が高い

---

## 🎯 次のアクション

1. **即座に対応**: 問題1と問題7を修正
2. **確認**: `evaluation.txt`の出力形式と既存コードの互換性を確認
3. **テスト**: 修正後の動作確認
4. **改善**: 優先度3の改善項目を計画的に実施
