# ルーティング分析と改善提案

## 現在の構造

### 想定挙動
1. ✅ 問題の指定（試験種別等の選択により）→問題文の呼出しと裏で出題趣旨を保持（{PURPOSE_TEXT}）
2. ✅ 入力の受付
3. ⚠️ 入力のJSON化（実装されているが、評価と統合されている）
4. ❌ JSONの評価（プロンプトは作成済みだが、実装されていない）

## 現在の実装の問題点

### 1. JSON化と評価が分離されていない
- `generate_review`関数は1回のLLM呼び出しのみ
- `input_processing.txt`と`evaluation.txt`の2段階処理が実装されていない
- 現在は旧形式のプロンプト（評価を含む）を使用している可能性がある

### 2. ルーティングフロー

#### Streamlit側（review.py）
```
問題選択 → 問題文表示 → 答案入力 → generate_review()呼び出し
```

#### API側（main.py）
```
create_review() → generate_review() → LLM呼び出し（1回のみ）
```

#### LLM側（llm_service.py）
```
generate_review() → _build_prompt() → input_processing.txt使用
                  → LLM呼び出し（JSON化のみ）
                  → 評価処理なし
```

## 改善提案

### 新しいルーティングフロー

```
1. 問題選択
   ↓
2. 問題文表示 + 出題趣旨を裏で保持（purpose_text）
   ↓
3. 答案入力受付
   ↓
4. JSON化処理（input_processing.txt使用）
   ↓
5. JSON評価処理（evaluation.txt使用）
   ↓
6. 評価結果を統合して最終講評を生成
```

### 実装すべき変更

1. `generate_review`関数を2段階に分割：
   - `_jsonize_answer()`: 答案をJSON化（input_processing.txt使用）
   - `_evaluate_json()`: JSONを評価（evaluation.txt使用）

2. 最終的な講評JSON構造：
```json
{
  "analysis_json": {
    // input_processing.txtで生成されたJSON
    "paragraphs": [...],
    "overall_structure": {...}
  },
  "evaluation": {
    // evaluation.txtで生成された評価結果
    "is_valid": true,
    "overall_quality": "good",
    "validation_results": {...},
    "suggestions": [...],
    "revised_json": {...}
  },
  "final_review": {
    // 評価結果を統合した最終講評
    "score": 75,
    "strengths": [...],
    "weaknesses": [...],
    "next_actions": [...]
  }
}
```
