# 多段階処理の提案

## 現状の構成

### 現在の2段階プロセス
1. **input_processing.txt**: 答案をJSON形式に構造化（抽出のみ、評価なし）
2. **evaluation.txt**: 構造化されたJSONを評価し、点数付け・改善点を指摘

## 提案：多段階処理の分割案

### 案1: 4段階プロセス（推奨）

#### **Step 1: 段落分割と原文抽出** (`step1_paragraph_extraction.txt`)
**役割**: 答案を意味のある段落に分割し、各段落の原文を抽出する
**出力**:
```json
{
  "paragraphs": [
    {
      "paragraph_number": 1,
      "original_text": "段落の完全な原文",
      "paragraph_type": "序論" | "本論" | "結論" | "その他",
      "word_count": 150
    }
  ],
  "total_paragraphs": 5,
  "total_word_count": 2000
}
```
**評価**: なし

#### **Step 2: 要素抽出** (`step2_element_extraction.txt`)
**役割**: 各段落から論点、規範、あてはめ、結論を抽出する
**入力**: Step 1の出力 + 問題文（参考情報）
**出力**:
```json
{
  "paragraphs": [
    {
      "paragraph_number": 1,
      "elements": {
        "issue_identification": {
          "present": true,
          "content": "記載されている論点の内容",
          "explicit": true
        },
        "norm_establishment": {
          "present": true,
          "content": "記載されている規範の内容",
          "explicit": true
        },
        "application": {
          "present": true,
          "content": "記載されているあてはめの内容",
          "explicit": true
        },
        "conclusion": {
          "present": true,
          "content": "記載されている結論の内容",
          "explicit": true
        }
      }
    }
  ],
  "overall_structure": {
    "issues_identified": ["論点1", "論点2"],
    "logical_flow": "段落間の接続関係の説明"
  }
}
```
**評価**: なし

#### **Step 3: 適切性評価** (`step3_quality_assessment.txt`)
**役割**: 抽出された要素の適切性を評価する（各要素ごと）
**入力**: Step 2の出力 + 問題文 + 出題趣旨
**出力**:
```json
{
  "element_assessments": [
    {
      "paragraph_number": 1,
      "assessments": {
        "issue_identification": {
          "appropriateness": "適切" | "やや適切" | "不適切",
          "reason": "評価理由",
          "alignment_with_purpose": true/false
        },
        "norm_establishment": {
          "appropriateness": "適切" | "やや適切" | "不適切",
          "reason": "評価理由",
          "alignment_with_purpose": true/false
        },
        "application": {
          "appropriateness": "適切" | "やや適切" | "不適切",
          "reason": "評価理由",
          "alignment_with_purpose": true/false
        },
        "conclusion": {
          "appropriateness": "適切" | "やや適切" | "不適切",
          "reason": "評価理由",
          "alignment_with_purpose": true/false
        }
      }
    }
  ],
  "structure_assessment": {
    "logical_flow": "適切" | "やや適切" | "不適切",
    "reason": "評価理由"
  }
}
```
**評価**: あり（各要素の適切性評価）

#### **Step 4: 総合評価と講評生成** (`step4_comprehensive_review.txt`)
**役割**: 全体を統合して点数付け、強み・弱みの抽出、今後の行動指針を提示
**入力**: Step 2の出力 + Step 3の出力 + 出題趣旨
**出力**:
```json
{
  "overall_review": {
    "score": 75,
    "comment": "総評コメント"
  },
  "strengths": [
    {
      "category": "論点の拾い上げ",
      "description": "具体的な強みの説明",
      "paragraph_numbers": [1, 2]
    }
  ],
  "weaknesses": [
    {
      "category": "規範定立",
      "description": "具体的な改善点の説明",
      "paragraph_numbers": [3],
      "suggestion": "改善提案"
    }
  ],
  "future_considerations": [
    "今後意識すべきこと1",
    "今後意識すべきこと2"
  ]
}
```
**評価**: あり（総合評価）

---

### 案2: 5段階プロセス（より細分化）

#### **Step 1: 段落分割** (`step1_paragraph_split.txt`)
- 答案を段落に分割
- 各段落の原文を抽出

#### **Step 2: 要素抽出** (`step2_element_extraction.txt`)
- 各段落から論点・規範・あてはめ・結論を抽出

#### **Step 3: 構造理解** (`step3_structure_analysis.txt`)
- 段落間の関係を分析
- 全体の論理構造を把握
- 出題趣旨を読み、期待される構造を理解

#### **Step 4: 適切性評価** (`step4_appropriateness_evaluation.txt`)
- 各要素の適切性を評価
- 出題趣旨との整合性を確認

#### **Step 5: 総合評価** (`step5_comprehensive_review.txt`)
- 点数付け
- 強み・弱みの抽出
- 今後の行動指針

---

### 案3: 3段階プロセス（現状より少し細分化）

#### **Step 1: 構造化と抽出** (`step1_extraction.txt`)
- 段落分割 + 要素抽出を同時に実行
- 現状の`input_processing.txt`と同じ役割

#### **Step 2: 適切性評価** (`step2_quality_evaluation.txt`)
- 抽出された要素の適切性を評価
- 出題趣旨との整合性を確認
- 各要素ごとに評価

#### **Step 3: 総合評価** (`step3_final_review.txt`)
- 点数付け
- 強み・弱みの抽出
- 今後の行動指針

---

## 各案の比較

### 案1（4段階）のメリット・デメリット

**メリット**:
- 各ステップの責任が明確
- 段落分割と要素抽出を分離することで、精度向上の可能性
- 適切性評価を別ステップにすることで、評価基準を明確化
- デバッグ・調整が容易

**デメリット**:
- LLM呼び出し回数が増える（4回）
- トークン使用量が増える可能性
- 処理時間が長くなる

### 案2（5段階）のメリット・デメリット

**メリット**:
- 最も細かく分離されている
- 各ステップの責任が非常に明確
- 問題が発生した際の原因特定が容易

**デメリット**:
- LLM呼び出し回数が最も多い（5回）
- トークン使用量が大幅に増える
- 処理時間が長くなる
- 実装が複雑になる

### 案3（3段階）のメリット・デメリット

**メリット**:
- 現状と比較的近い構成
- LLM呼び出し回数が少ない（3回）
- 実装変更が比較的少ない

**デメリット**:
- Step 2が重くなる可能性（適切性評価が多くの要素を扱う）

---

## 推奨案

### 推奨: **案1（4段階プロセス）**

**理由**:
1. **適切な粒度**: 細かすぎず、粗すぎない適切な粒度
2. **責任の明確化**: 各ステップの役割が明確で、将来的な調整が容易
3. **精度向上の可能性**: 段落分割と要素抽出を分離することで、それぞれの精度向上が期待できる
4. **評価の明確化**: 適切性評価を独立させることで、評価基準を明確にできる
5. **実用性**: 4回のLLM呼び出しは許容範囲内

### 実装時の考慮事項

1. **エラーハンドリング**: 各ステップでエラーが発生した場合の処理
2. **中間結果の保存**: 各ステップの結果を保存し、デバッグや再実行を可能にする
3. **並列処理の可能性**: Step 1とStep 2は並列処理できないが、Step 3とStep 4の一部は並列化できる可能性
4. **トークン使用量の最適化**: 各ステップで必要な情報のみを渡すように最適化
5. **処理時間の可視化**: 各ステップの処理時間を計測し、ボトルネックを特定

---

## 実装イメージ

### 関数構成（案1に基づく）

```python
def generate_review(...):
    # Step 1: 段落分割
    paragraph_data = step1_extract_paragraphs(client, answer_text)
    
    # Step 2: 要素抽出
    element_data = step2_extract_elements(
        client, paragraph_data, question_text, subject
    )
    
    # Step 3: 適切性評価
    quality_assessment = step3_assess_quality(
        client, element_data, purpose_text, question_text, subject
    )
    
    # Step 4: 総合評価
    final_review = step4_generate_comprehensive_review(
        client, element_data, quality_assessment, purpose_text, subject
    )
    
    # 最終的なJSONを構築
    review_json = {
        "step1_paragraphs": paragraph_data,
        "step2_elements": element_data,
        "step3_assessment": quality_assessment,
        "step4_review": final_review
    }
    
    return review_markdown, review_json, model_name
```

---

## 次のステップ

1. **ユーザーとの確認**: どの案が適切かを確認
2. **プロンプトファイルの作成**: 選択した案に基づいて各ステップのプロンプトを作成
3. **実装**: `llm_service.py`を修正して多段階処理を実装
4. **テスト**: 各ステップが正しく動作することを確認
5. **最適化**: トークン使用量や処理時間を最適化
