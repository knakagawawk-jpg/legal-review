# evaluation.txtの多段階分割案（最終版）

## 現状の構成

### 現在のevaluation.txt
- 1段階目で生成されたJSON（答案の構造化データ）と出題趣旨を受け取り、一度に評価を実行
- 問題文・出題趣旨・答案の理解と評価が混在

## 提案：evaluation.txtを1つのプロンプトファイルで5ステップに分割

### 評価プロセスの全体像

**1つのプロンプトファイル（`evaluation.txt`）内で、以下の5ステップを順次実行します：**

```
Step 1: 出題趣旨を踏まえた問題文の理解（設問ごとに整理）
    ↓（出題趣旨を先に読む → 問題文を読む）
Step 2: 答案の理解
    ↓
Step 3: 答案の評価（骨格的観点と質的観点から評価）
    ↓
Step 4: 出題趣旨を再度確認し、Step 3の評価の適正性を検証
```

**重要**: 
- すべてのステップは1つのプロンプトファイル（`evaluation.txt`）内で実行される
- Step 3では、評価の観点として「骨格的観点」と「質的観点」を明確に分けて評価する
- ただし、「骨格のみ評価する」「質のみ評価する」という断絶ではなく、両方の観点から総合的に評価する

---

## 各ステップの詳細

### Step 1: 出題趣旨を踏まえた問題文の理解 (`evaluation_step1_question_analysis.txt`)

**役割**: 出題趣旨を先に読み、それを踏まえて問題文を読み、設問ごとに整理する

**入力**:
- 出題趣旨（`{PURPOSE_TEXT}`）- **先に読む**
- 問題文（`{QUESTION_TEXT}`）
- 科目別の留意事項（`{SUBJECT_SPECIFIC_GUIDELINES}`）

**処理内容**:
1. **出題趣旨を先に読み、理解する**
   - 出題者の意図を把握する
   - 評価基準の方向性を理解する
   
2. **出題趣旨を踏まえて問題文を読む**
   - 問題文を設問ごとに分割する（設問が複数ある場合）
   - 各設問について、以下を整理する：
     - **問われていること**: 各設問で何が問われているか
     - **解答のために必要な法的論点**: 各設問に答えるために必要な論点
     - **回答の指針・要考慮事情**: 各設問に対する回答の方向性や考慮すべき事情
     - **重要な問題文の事実**: 各設問で重要な事実関係

**出力**:
```json
{
  "question_analysis": {
    "purpose_context": {
      "examiner_intent": "出題趣旨から読み取れる出題者の意図の要約",
      "evaluation_direction": "評価の方向性（何が重視されるか）"
    },
    "questions": [
      {
        "question_number": 1,
        "question_text": "設問1の原文",
        "what_is_asked": "設問1で問われていること（簡潔に）",
        "required_legal_issues": [
          {
            "issue": "論点1",
            "importance": "最重要" | "重要" | "補足",
            "description": "論点の説明",
            "why_required": "なぜこの論点が必要か"
          },
          {
            "issue": "論点2",
            "importance": "最重要",
            "description": "論点の説明",
            "why_required": "なぜこの論点が必要か"
          },
          ...
        ],
        "answer_guidelines": {
          "direction": "回答の方向性（どう答えるべきか）",
          "considerations": [
            "考慮すべき事情1",
            "考慮すべき事情2",
            ...
          ],
          "key_points": [
            "回答時に重要なポイント1",
            "回答時に重要なポイント2",
            ...
          ]
        },
        "important_facts": [
          {
            "fact": "重要な事実1",
            "significance": "なぜ重要か",
            "relevance_to_issue": "どの論点に関連するか"
          },
          {
            "fact": "重要な事実2",
            "significance": "なぜ重要か",
            "relevance_to_issue": "どの論点に関連するか"
          },
          ...
        ],
        "expected_answer_structure": "この設問に対する期待される答案構成"
      },
      {
        "question_number": 2,
        ...
      },
      ...
    ],
    "overall_analysis": {
      "total_questions": 2,
      "main_theme": "問題全体のテーマ",
      "inter_question_relationships": "設問間の関係性（あれば）",
      "expected_overall_structure": "答案全体として期待される構成"
    }
  }
}
```

**評価**: なし（理解・整理のみ）

**タイミング**: 最初に実行（評価の基準となる情報を把握）

**重要**: 出題趣旨を**先に**読んでから問題文を読むことで、問題文を正しい文脈で理解する

---

### Step 2: 答案の理解 (`evaluation_step2_answer_understanding.txt`)

**役割**: 1段階目で抽出された答案の内容を整理・理解する

**入力**:
- 1段階目で生成されたJSON（`{REVIEW_JSON}`）
- Step 1の出力（問題文分析結果） - 参考情報として

**処理内容**:
- 1段階目で抽出された答案の記載内容を整理する
- 答案全体の構造を理解する
- 各段落でどの論点が扱われているかを把握する
- 答案の論理的な流れを理解する
- 答案に記載されている要素（論点、規範、あてはめ、結論）を整理する
- 設問ごとに答案がどのように対応しているかを把握する（設問が複数ある場合）

**出力**:
```json
{
  "answer_understanding": {
    "overall_structure": {
      "total_paragraphs": 5,
      "logical_flow": "答案全体の論理的な流れの説明",
      "main_issues_addressed": [
        "答案で扱われている論点1",
        "答案で扱われている論点2",
        ...
      ],
      "question_coverage": [
        {
          "question_number": 1,
          "paragraphs_covering": [1, 2, 3],
          "issues_addressed": ["論点1", "論点2"]
        },
        {
          "question_number": 2,
          "paragraphs_covering": [4, 5],
          "issues_addressed": ["論点3"]
        }
      ]
    },
    "paragraph_summaries": [
      {
        "paragraph_number": 1,
        "main_content": "段落の主要な内容",
        "issues_covered": ["論点1", "論点2"],
        "elements_present": {
          "issue_identification": true,
          "norm_establishment": true,
          "application": true,
          "conclusion": true
        },
        "key_points": [
          "段落で重要なポイント1",
          "段落で重要なポイント2",
          ...
        ],
        "related_question": 1
      },
      ...
    ],
    "answer_coverage": {
      "issues_identified": ["答案で扱われている論点のリスト"],
      "issues_completeness": {
        "issue_identification": "完全" | "部分的" | "不足",
        "norm_establishment": "完全" | "部分的" | "不足",
        "application": "完全" | "部分的" | "不足",
        "conclusion": "完全" | "部分的" | "不足"
      }
    }
  }
}
```

**評価**: なし（理解・整理のみ。適切性の判断は行わない）

**タイミング**: Step 1の後（問題文の理解が完了してから答案を理解）

---

### Step 3: 答案の評価 (`evaluation_step3_assessment.txt`)

**役割**: 答案を多角的に評価する。評価の観点として、「骨格的観点」と「質的観点」を明確に分けて評価するが、両方の観点を総合的に考慮して評価を行う。

**入力**:
- Step 1の出力（問題文分析結果）
- Step 2の出力（答案理解結果）
- 1段階目で生成されたJSON（参照用）

**処理内容**:

#### 3-1. 骨格的観点からの評価
- 答案で扱われている論点が、Step 1で抽出された必要な論点をカバーしているかを評価
- 答案の全体構成が適切かを評価
- 設問ごとの対応が適切かを評価（設問が複数ある場合）
- 論点の優先順位が適切かを評価
- 論点間の論理的な接続が適切かを評価

#### 3-2. 質的観点からの評価
- 各要素（規範定立、あてはめ、結論）の質を評価
- 規範定立の明確性・正確性を評価
- あてはめの適切性・論理性を評価
- 結論の明確性・論理性を評価
- 各要素間の論理的接続を評価
- 記載内容の法的正確性を評価（可能な範囲で）

#### 3-3. 統合的な評価
- 骨格的観点と質的観点の両方を総合的に考慮
- 両観点のバランスを確認
- 答案全体としての適切性を判断

**出力**:
```json
{
  "answer_assessment": {
    "structural_perspective": {
      "issue_coverage_assessment": {
        "covered_issues": [
          {
            "issue": "論点1",
            "covered": true,
            "paragraph_numbers": [1, 2],
            "coverage_quality": "適切" | "やや適切" | "不適切",
            "reason": "評価理由"
          },
          {
            "issue": "論点2",
            "covered": false,
            "should_be_covered": true,
            "importance": "最重要",
            "reason": "この論点が漏れている理由・影響"
          },
          ...
        ],
        "coverage_score": 80,
        "overall_assessment": "必要論点のカバーが適切かどうかの総合評価"
      },
      "structure_quality_assessment": {
        "overall_structure": {
          "appropriateness": "適切" | "やや適切" | "不適切",
          "reason": "構成が適切かどうかの評価理由",
          "strengths": ["構成の良い点1", "構成の良い点2"],
          "weaknesses": ["構成の改善点1", "構成の改善点2"]
        },
        "logical_flow": {
          "appropriateness": "適切" | "やや適切" | "不適切",
          "reason": "論理的な流れの評価理由",
          "strengths": ["論理展開の良い点"],
          "weaknesses": ["論理展開の改善点"]
        },
        "paragraph_connections": {
          "appropriateness": "適切" | "やや適切" | "不適切",
          "reason": "段落間の接続の評価理由",
          "strengths": ["接続の良い点"],
          "weaknesses": ["接続の改善点"]
        }
      },
      "question_response_assessment": [
        {
          "question_number": 1,
          "response_appropriateness": "適切" | "やや適切" | "不適切",
          "coverage": "設問への対応が適切か",
          "completeness": "設問に対する回答が完全か",
          "reason": "評価理由",
          "strengths": ["設問対応の良い点"],
          "weaknesses": ["設問対応の改善点"]
        },
        ...
      ],
      "issue_priority_assessment": {
        "priority_appropriateness": "適切" | "やや適切" | "不適切",
        "reason": "論点の優先順位が適切かどうかの評価理由",
        "recommendations": ["優先順位に関する改善提案"]
      },
      "structural_score": 75
    },
    "quality_perspective": {
      "element_assessments": [
        {
          "paragraph_number": 1,
          "assessments": {
            "issue_identification": {
              "quality": "高い" | "普通" | "低い",
              "clarity": "明確" | "やや明確" | "不明確",
              "appropriateness": "適切" | "やや適切" | "不適切",
              "reason": "評価理由（具体的に）",
              "strengths": ["良い点1", "良い点2"],
              "weaknesses": ["改善点1", "改善点2"]
            },
            "norm_establishment": {
              "quality": "高い" | "普通" | "低い",
              "clarity": "明確" | "やや明確" | "不明確",
              "accuracy": "正確" | "やや正確" | "不正確",
              "completeness": "完全" | "部分的" | "不足",
              "reason": "評価理由（具体的に）",
              "strengths": ["良い点1", "良い点2"],
              "weaknesses": ["改善点1", "改善点2"]
            },
            "application": {
              "quality": "高い" | "普通" | "低い",
              "fact_usage": "適切" | "やや適切" | "不適切",
              "logical_connection": "明確" | "やや明確" | "不明確",
              "evaluation_language": "適切" | "やや適切" | "不適切",
              "reason": "評価理由（具体的に）",
              "strengths": ["良い点1", "良い点2"],
              "weaknesses": ["改善点1", "改善点2"]
            },
            "conclusion": {
              "quality": "高い" | "普通" | "低い",
              "clarity": "明確" | "やや明確" | "不明確",
              "logical_derivation": "論理的" | "やや論理的" | "非論理的",
              "reason": "評価理由（具体的に）",
              "strengths": ["良い点1", "良い点2"],
              "weaknesses": ["改善点1", "改善点2"]
            }
          }
        },
        ...
      ],
      "inter_element_connection_assessment": {
        "issue_to_norm": {
          "quality": "高い" | "普通" | "低い",
          "reason": "論点と規範の接続の評価理由"
        },
        "norm_to_application": {
          "quality": "高い" | "普通" | "低い",
          "reason": "規範とあてはめの接続の評価理由"
        },
        "application_to_conclusion": {
          "quality": "高い" | "普通" | "低い",
          "reason": "あてはめと結論の接続の評価理由"
        }
      },
      "quality_score": 72
    },
    "integrated_assessment": {
      "overall_appropriateness": "適切" | "やや適切" | "不適切",
      "balance_between_perspectives": "バランスが取れている" | "やや偏りがある" | "偏りが大きい",
      "reason": "骨格的観点と質的観点を総合的に考慮した評価理由",
      "overall_score": 74
    }
  }
}
```

**評価**: あり（骨格的観点と質的観点の両方から評価）

**タイミング**: Step 1とStep 2の後（問題文と答案の理解が完了してから）

**重要**: 骨格的観点と質的観点は別々の評価として実施するが、最終的には両方の観点を総合的に考慮して答案全体の適切性を判断する。一方の観点のみに偏った評価は行わない。

---

### Step 4: 出題趣旨の再確認と評価の適正性検証 (`evaluation_step4_validation.txt`)

**役割**: 出題趣旨を再度確認し、Step 3とStep 4の評価が適正かを検証し、総合評価を生成する

**入力**:
- 出題趣旨（`{PURPOSE_TEXT}`）- **再度読み直す**
- Step 1の出力（問題文分析結果）
- Step 2の出力（答案理解結果）
- Step 3の出力（答案評価結果：骨格的観点と質的観点の両方）
- 1段階目で生成されたJSON（参照用）

**処理内容**:
1. **出題趣旨を再度読み直し、確認する**
   - Step 1で理解した出題趣旨と一致しているか確認
   - 出題趣旨で特に強調されている点を再確認
   - 評価基準の重みづけを再確認

2. **Step 3の評価結果の適正性を検証**
   - 骨格的観点からの評価が出題趣旨の意図と合致しているか確認
   - 質的観点からの評価が出題趣旨の期待と合致しているか確認
   - 両観点のバランスが適切か確認
   - 評価が適切な方向性を示しているか確認
   - 修正が必要な場合は指摘

3. **総合評価を生成**
   - Step 3の評価結果（骨格的観点と質的観点の両方）を統合
   - 出題趣旨を踏まえた最終的な点数を付与（0-100）
   - 強み（strengths）を抽出（各カテゴリごとに複数）
   - 弱み（weaknesses）を抽出（各カテゴリごとに複数）
   - 今後の行動指針（future_considerations）を提示
   - 総評コメントを生成

**出力**:
```json
{
  "purpose_revalidation": {
    "reconfirmed_intent": "再確認した出題者の意図",
    "reconfirmed_evaluation_criteria": "再確認した評価基準",
    "key_emphasis_points": [
      "出題趣旨で特に強調されている点1",
      "出題趣旨で特に強調されている点2",
      ...
    ]
  },
  "evaluation_validation": {
    "assessment_validation": {
      "structural_perspective_validation": {
        "is_appropriate": true/false,
        "alignment_with_purpose": "出題趣旨との整合性",
        "adjustments_needed": [
          {
            "assessment_item": "評価項目",
            "adjustment": "必要な調整",
            "reason": "調整理由"
          }
        ]
      },
      "quality_perspective_validation": {
        "is_appropriate": true/false,
        "alignment_with_purpose": "出題趣旨との整合性",
        "adjustments_needed": [
          {
            "assessment_item": "評価項目",
            "adjustment": "必要な調整",
            "reason": "調整理由"
          }
        ]
      },
      "balance_validation": {
        "is_appropriate": true/false,
        "reason": "両観点のバランスが適切かどうかの検証理由"
      }
    },
  "final_comprehensive_review": {
    "overall_review": {
      "score": 74,
      "comment": "総評コメント（出題趣旨を踏まえた答案全体の評価を簡潔に、具体的な根拠を含む）",
      "score_breakdown": {
        "structural_perspective": 38,
        "quality_perspective": 36
      },
      "score_breakdown_detailed": {
        "issue_coverage": 20,
        "structure_quality": 18,
        "norm_establishment": 18,
        "application": 12,
        "conclusion": 6
      },
      "summary": {
        "overall_quality": "良い" | "やや良い" | "普通" | "やや悪い" | "悪い",
        "main_strengths_summary": "主な強みの要約（出題趣旨との関連を含む）",
        "main_weaknesses_summary": "主な弱みの要約（出題趣旨との関連を含む）"
      }
    },
    "strengths": [
      {
        "category": "論点の拾い上げ" | "規範定立" | "あてはめ" | "結論" | "構造" | "その他",
        "description": "評価した点の具体的な説明（なぜ良いのかの根拠を含む、出題趣旨との関連も言及）",
        "paragraph_numbers": [1, 2],
        "reference_to_purpose": "出題趣旨との関連（具体的に）"
      },
      ...
    ],
    "weaknesses": [
      {
        "category": "論点の拾い上げ" | "規範定立" | "あてはめ" | "結論" | "構造" | "その他",
        "description": "改善点の具体的な説明（なぜ改善が必要なのかの理由を含む、出題趣旨との関連も言及）",
        "paragraph_numbers": [3, 4],
        "reference_to_purpose": "出題趣旨との関連（具体的に）",
        "suggestion": "具体的な改善提案（任意）"
      },
      ...
    ],
    "future_considerations": [
      "今後意識すべきこと1（出題趣旨を踏まえた具体的な行動指針）",
      "今後意識すべきこと2（出題趣旨を踏まえた具体的な行動指針）",
      ...
    ]
  }
}
```

**評価**: あり（評価の適正性検証と総合評価）

**タイミング**: 最後（すべての評価が完了してから、出題趣旨を再確認して検証）

**重要**: 出題趣旨を再度読み直すことで、評価の方向性が適切かを検証する

---

## 実装イメージ

### 関数構成

```python
def generate_review(...):
    # 1段階目: 答案のJSON化（input_processing.txt）
    analysis_json = _jsonize_answer(
        client, subject, question_text, answer_text, purpose_text
    )
    
    # 2段階目: evaluationの多段階処理
    # Step 1: 出題趣旨を踏まえた問題文の理解
    question_analysis = evaluation_step1_analyze_question_with_purpose(
        client, purpose_text, question_text, subject
    )
    
    # Step 2: 答案の理解
    answer_understanding = evaluation_step2_understand_answer(
        client, analysis_json, question_analysis, subject
    )
    
    # Step 3: 答案の評価（骨格的観点と質的観点から評価）
    answer_assessment = evaluation_step3_assess_answer(
        client, question_analysis, answer_understanding, analysis_json, subject
    )
    
    # Step 4: 出題趣旨の再確認と評価の適正性検証
    final_review = evaluation_step4_validate_and_finalize(
        client, purpose_text, question_analysis, answer_understanding, 
        answer_assessment, analysis_json, subject
    )
    
    # 最終的な講評JSONを構築
    review_json = {
        "analysis_json": analysis_json,
        "evaluation": {
            "step1_question_analysis": question_analysis,
            "step2_answer_understanding": answer_understanding,
            "step3_answer_assessment": answer_assessment,
            "step4_final_review": final_review
        },
        "final_review": final_review["final_comprehensive_review"]
    }
    
    # マークダウン形式の講評を生成
    review_markdown = _format_markdown(subject, review_json)
    
    return review_markdown, review_json, ANTHROPIC_MODEL
```

---

## この分割の特徴

### 1. 出題趣旨の2回読み
- **Step 1**: 出題趣旨を先に読んでから問題文を読む（正しい文脈で問題文を理解）
- **Step 5**: 出題趣旨を再度読み直して評価の適正性を検証（評価の方向性が適切かを確認）

### 2. 評価の2段階分割
- **Step 3（骨格評価）**: 構造・構成・論点のカバーなどの「骨格」を評価
- **Step 4（クオリティ評価）**: 規範定立、あてはめ、結論などの「質」を評価

### 3. 設問ごとの対応
- **Step 1**: 設問ごとに整理
- **Step 2-4**: 設問ごとの対応を評価
- 設問が複数ある場合にも対応

### 4. 評価の適正性検証
- **Step 5**: 出題趣旨を再度確認し、Step 3とStep 4の評価が適正かを検証
- 必要に応じて評価を調整

---

## メリット・デメリット

### メリット

1. **出題趣旨の活用**: 出題趣旨を2回読むことで、理解と評価の両方で活用
2. **評価の明確化**: 骨格評価とクオリティ評価を分離することで、評価の視点が明確
3. **評価の適正性**: Step 5で評価の適正性を検証することで、一貫性のある評価が可能
4. **設問対応**: 設問ごとの整理・評価が可能
5. **プロセスの透明性**: 各ステップの結果を確認することで、評価過程が可視化

### デメリット

1. **LLM呼び出し回数の増加**: 5回のLLM呼び出しが必要（evaluation部分のみ）
2. **トークン使用量の増加**: 各ステップで中間結果を生成するため、トークン使用量が増える
3. **処理時間の増加**: 5回のLLM呼び出しにより、処理時間が長くなる
4. **実装の複雑化**: 各ステップ間のデータ受け渡しを管理する必要がある

---

## 次のステップ

1. **プロンプトファイルの作成**: 1つのプロンプトファイル（`evaluation.txt`）内に5つのステップの指示を含める
   - Step 1: 出題趣旨を踏まえた問題文の理解
   - Step 2: 答案の理解
   - Step 3: 答案の評価（骨格的観点と質的観点から評価）
   - Step 4: 出題趣旨の再確認と評価の適正性検証

2. **実装**: `llm_service.py`を修正して多段階処理を実装

3. **テスト**: 各ステップが正しく動作することを確認

4. **最適化**: トークン使用量や処理時間を最適化

5. **ユーザーへのフィードバック**: 評価プロセスの可視化（オプション）
