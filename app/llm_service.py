import os
import json
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List
from anthropic import Anthropic

# 設定を読み込む（後方互換性のため環境変数も確認）
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
try:
    from config.settings import ANTHROPIC_API_KEY, ANTHROPIC_MODEL
except ImportError:
    # フォールバック: 環境変数から取得
    # 注意: モデル名はユーザーが明示的に指定したものです。AIが勝手に変更しないでください。
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

# プロンプトファイルのベースディレクトリ
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# グローバル変数として公開（デバッグ用）
# 注意: ANTHROPIC_API_KEYはセキュリティ上の理由で公開しない

def generate_review(
    subject: str,
    question_text: Optional[str],
    answer_text: str,
    purpose_text: Optional[str] = None,
    grading_impression_text: Optional[str] = None,
) -> tuple[str, Dict[str, Any], str]:
    """
    LLMを使って答案の講評を生成する（1段階処理：答案を直接評価）
    
    Returns:
        tuple: (review_markdown, review_json, model_name)
    """
    # APIキーが設定されていない場合はダミーを返す
    if not ANTHROPIC_API_KEY:
        return _generate_dummy_review(subject)
    
    try:
        client = Anthropic(api_key=ANTHROPIC_API_KEY)
        
        # ===== 答案の評価（1段階処理） =====
        print("答案の評価を開始...")
        evaluation_result = _evaluate_answer(
            client,
            subject,
            question_text,
            answer_text,
            purpose_text,
            grading_impression_text,
        )
        
        # ===== 講評JSONを構築（evaluationのみ保持） =====
        review_json = {
            "evaluation": evaluation_result
        }
        
        # マークダウン形式の講評を生成
        review_markdown = _format_markdown(subject, review_json)
        
        return review_markdown, review_json, ANTHROPIC_MODEL
        
    except Exception as e:
        # エラーが発生した場合は例外を再発生させる（FastAPIで処理）
        import traceback
        error_detail = traceback.format_exc()
        print(f"LLM生成エラー: {e}\n{error_detail}")
        raise Exception(f"講評生成中にエラーが発生しました: {str(e)}") from e


# _jsonize_answer関数は削除（1段階処理では不要）

def _evaluate_answer(
    client: Anthropic,
    subject: str,
    question_text: Optional[str],
    answer_text: str,
    purpose_text: Optional[str] = None,
    grading_impression_text: Optional[str] = None,
) -> Dict[str, Any]:
    """答案を直接評価（evaluation.txt使用）"""
    try:
        # プロンプトテンプレートを読み込む
        template = _load_prompt_template("evaluation")
        
        if not template:
            # 評価プロンプトがない場合は空の評価結果を返す
            return {
                "overall_review": {
                    "score": 65,
                    "comment": "評価プロンプトが読み込めませんでした"
                },
                "strengths": [],
                "weaknesses": [],
                "future_considerations": []
            }
        
        # 科目別の留意事項を読み込む
        subject_guidelines = _load_subject_guidelines(subject)
        
        # 変数を置換
        prompt = template.replace("{SUBJECT_SPECIFIC_GUIDELINES}", subject_guidelines)
        prompt = prompt.replace("{PURPOSE_TEXT}", purpose_text or "（出題趣旨なし）")
        prompt = prompt.replace("{GRADING_IMPRESSION_TEXT}", grading_impression_text or "（採点実感なし）")
        prompt = prompt.replace("{QUESTION_TEXT}", question_text or "（問題文なし）")
        prompt = prompt.replace("{ANSWER_TEXT}", answer_text)
        
        # プロンプトの構築
        system_prompt = "あなたは司法試験・予備試験の法律答案講評の品質を評価する専門家です。"
        
        # Claude APIにリクエスト
        message = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=16384,  # 長い評価に対応するためさらに増加（16Kトークン）
            temperature=0.3,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": prompt + "\n\n重要: レスポンスは必ず有効なJSON形式で返してください。文字列内の改行や特殊文字は適切にエスケープしてください。"
                }
            ]
        )
        
        # レスポンスをパース
        if not message.content or len(message.content) == 0:
            raise Exception("LLMからのレスポンスが空です")
        
        # トークン使用量をログに記録
        if hasattr(message, 'usage') and message.usage:
            import logging
            logger = logging.getLogger(__name__)
            input_tokens = getattr(message.usage, 'input_tokens', 0)
            output_tokens = getattr(message.usage, 'output_tokens', 0)
            total_tokens = input_tokens + output_tokens
            logger.info(f"評価トークン使用量: 入力={input_tokens}, 出力={output_tokens}, 合計={total_tokens}")
            print(f"評価トークン使用量: 入力={input_tokens}, 出力={output_tokens}, 合計={total_tokens}")
        
        content = message.content[0].text
        content = _extract_json_from_response(content)
        
        # JSONの修復を試みる（簡単な修復のみ）
        content = _try_repair_json(content)
        
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            # エラー位置の前後のテキストを取得
            error_pos = getattr(e, 'pos', None)
            if error_pos:
                start = max(0, error_pos - 200)
                end = min(len(content), error_pos + 200)
                error_context = content[start:end]
                error_marker = " " * (error_pos - start) + "^" if error_pos >= start else ""
                error_detail = f"エラー位置: {error_pos}文字目 (行{e.lineno}, 列{e.colno})\nエラー前後のテキスト:\n{error_context}\n{error_marker}"
            else:
                error_detail = f"エラー: {str(e)}"
            
            # ログファイルに完全なレスポンスを保存
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"JSONパースエラー（評価）: {error_detail}\n完全なレスポンス（最初の2000文字）: {content[:2000]}")
            
            raise Exception(f"JSONパースエラー（評価）: {str(e)}\n{error_detail}\nレスポンスの最初の500文字: {content[:500]}")
    except Exception as e:
        error_type = type(e).__name__
        raise Exception(f"答案の評価に失敗しました [{error_type}]: {str(e)}") from e


def _try_repair_json(json_str: str) -> str:
    """JSONの簡単な修復を試みる"""
    import re
    
    # 1. 文字列リテラル内の改行をエスケープ（簡易版）
    # ダブルクォートで囲まれた部分を探す
    result = []
    i = 0
    in_string = False
    escape_next = False
    string_start = -1
    
    while i < len(json_str):
        char = json_str[i]
        
        if escape_next:
            result.append(char)
            escape_next = False
        elif char == '\\':
            result.append(char)
            escape_next = True
        elif char == '"' and not escape_next:
            if not in_string:
                # 文字列の開始
                in_string = True
                string_start = len(result)
            else:
                # 文字列の終了
                in_string = False
                string_start = -1
            result.append(char)
        elif in_string:
            if char == '\n':
                result.append('\\n')
            elif char == '\r':
                result.append('\\r')
            elif char == '\t':
                result.append('\\t')
            elif char == '"':
                result.append('\\"')
            else:
                result.append(char)
        else:
            result.append(char)
        
        i += 1
    
    json_str = ''.join(result)
    
    # 2. 未終了の文字列リテラルを修復（文字列が閉じられていない場合）
    # 文字列の開始位置を追跡し、閉じられていない文字列を閉じる
    result = []
    i = 0
    in_string = False
    escape_next = False
    brace_count = 0
    bracket_count = 0
    
    while i < len(json_str):
        char = json_str[i]
        
        if escape_next:
            result.append(char)
            escape_next = False
        elif char == '\\':
            result.append(char)
            escape_next = True
        elif char == '"' and not escape_next:
            in_string = not in_string
            result.append(char)
        elif not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
            elif char == '[':
                bracket_count += 1
            elif char == ']':
                bracket_count -= 1
            result.append(char)
        else:
            result.append(char)
        
        i += 1
    
    json_str = ''.join(result)
    
    # 未終了の文字列があれば閉じる（最後の文字列が閉じられていない場合）
    if in_string:
        # 文字列を閉じる前に、改行や特殊文字をエスケープ
        json_str += '"'
        # その後、未閉じのオブジェクト/配列を閉じる必要がある
        # ただし、文字列内にいた場合は、その前の構造も閉じる必要がある
        # 簡易的な修復: 文字列を閉じた後、カンマを追加してから閉じる
        if brace_count > 0 or bracket_count > 0:
            # 文字列の後にカンマを追加（オブジェクト/配列内の場合）
            if json_str.rstrip().endswith('"') and not json_str.rstrip().endswith('",'):
                # 最後の文字列の後にカンマがない場合、追加する必要があるか判断
                # ただし、これは複雑なので、単純に閉じる
                pass
    
    # 3. 括弧で囲まれた数値を通常の数値に変換（例: (1) → 1）
    # 文字列外でのみ置換するため、文字列内の括弧は除外
    def replace_parenthesized_numbers(text):
        result = []
        i = 0
        in_string = False
        escape_next = False
        
        while i < len(text):
            char = text[i]
            
            if escape_next:
                result.append(char)
                escape_next = False
            elif char == '\\':
                result.append(char)
                escape_next = True
            elif char == '"' and not escape_next:
                in_string = not in_string
                result.append(char)
            elif not in_string:
                # 文字列外で括弧で囲まれた数値を検出
                if char == '(':
                    # 次の文字が数字か確認
                    num_start = i + 1
                    num_end = num_start
                    while num_end < len(text) and text[num_end].isdigit():
                        num_end += 1
                    # 閉じ括弧があるか確認
                    if num_end < len(text) and text[num_end] == ')':
                        # 数値を抽出して括弧なしで追加
                        number = text[num_start:num_end]
                        result.append(number)
                        i = num_end  # 閉じ括弧をスキップ
                    else:
                        result.append(char)
                else:
                    result.append(char)
            else:
                result.append(char)
            
            i += 1
        
        return ''.join(result)
    
    json_str = replace_parenthesized_numbers(json_str)
    
    # 4. 末尾の不要なカンマを削除（ただし、文字列内のカンマは除外）
    json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
    
    # 5. 未閉じの括弧を閉じる
    while brace_count > 0:
        json_str += '}'
        brace_count -= 1
    while bracket_count > 0:
        json_str += ']'
        bracket_count -= 1
    
    return json_str


def _extract_json_from_response(content: str) -> str:
    """レスポンスからJSONを抽出（より堅牢な方法）"""
    import re
    
    original_content = content
    content = content.strip()
    
    # ```json ... ``` のパターンを探す
    json_block_pattern = r'```(?:json)?\s*(\{.*?\})\s*```'
    match = re.search(json_block_pattern, content, re.DOTALL)
    if match:
        extracted = match.group(1).strip()
        # 改行文字を保持したまま返す（後で_try_repair_jsonで処理）
        return extracted
    
    # ``` ... ``` のパターンを探す（json指定なし）
    code_block_pattern = r'```\s*(\{.*?\})\s*```'
    match = re.search(code_block_pattern, content, re.DOTALL)
    if match:
        extracted = match.group(1).strip()
        return extracted
    
    # { から始まるJSONを探す
    json_start = content.find('{')
    if json_start != -1:
        # 対応する } を見つける（ネストを考慮）
        brace_count = 0
        json_end = -1
        in_string = False
        escape_next = False
        
        for i in range(json_start, len(content)):
            char = content[i]
            
            if escape_next:
                escape_next = False
            elif char == '\\':
                escape_next = True
            elif char == '"' and not escape_next:
                in_string = not in_string
            elif not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        json_end = i + 1
                        break
        
        if json_end != -1:
            return content[json_start:json_end].strip()
    
    # フォールバック: 元の処理
    if content.startswith("```json"):
        content = content[7:]  # ```json を削除
    if content.startswith("```"):
        content = content[3:]  # ``` を削除
    if content.endswith("```"):
        content = content[:-3]  # ``` を削除
    return content.strip()


# _build_final_review関数は削除（1段階処理では不要）


def _load_prompt_template(template_name: str) -> str:
    """プロンプトテンプレートファイルを読み込む"""
    template_path = PROMPTS_DIR / "main" / f"{template_name}.txt"
    if not template_path.exists():
        raise FileNotFoundError(f"プロンプトテンプレートが見つかりません: {template_path}")
    return template_path.read_text(encoding="utf-8")

def _load_subject_guidelines(subject: str) -> str:
    """科目別の留意事項を読み込む"""
    # 科目名からファイル名へのマッピング
    subject_mapping = {
        "憲 法": "constitution",
        "憲法": "constitution",
        "行政法": "administrative_law",
        "民 法": "civil_law",
        "民法": "civil_law",
        "商 法": "commercial_law",
        "商法": "commercial_law",
        "民事訴訟法": "civil_procedure",
        "刑 法": "criminal_law",
        "刑法": "criminal_law",
        "刑事訴訟法": "criminal_procedure",
        "実務基礎（民事）": "civil_practice",
        "実務基礎（刑事）": "criminal_practice",
    }
    
    file_name = subject_mapping.get(subject, "default")
    guidelines_path = PROMPTS_DIR / "subjects" / f"{file_name}.txt"
    
    if guidelines_path.exists():
        return guidelines_path.read_text(encoding="utf-8")
    else:
        # デフォルトファイルを読み込む
        default_path = PROMPTS_DIR / "subjects" / "default.txt"
        if default_path.exists():
            return default_path.read_text(encoding="utf-8")
        return ""

# _build_prompt関数と_build_prompt_legacy関数は削除（1段階処理では不要）

def _format_markdown(subject: str, review_json: Dict[str, Any]) -> str:
    """JSON形式の講評をマークダウン形式に変換（1段階処理用：evaluationのみ）"""
    parts = [
        f"### 答案講評",
        f"科目: **{subject}**",
        f"",
    ]
    
    # 新しい構造（evaluationのみ）
    evaluation = review_json.get("evaluation", {})
    
    # 総評（スコアとコメント）
    overall_review = evaluation.get("overall_review", {})
    score = overall_review.get("score", 65)
    comment = overall_review.get("comment", "")
    
    parts.extend([
        f"### 📊 総評",
        f"",
        f"**点数: {score}点**",
        f"",
    ])
    
    if comment:
        parts.extend([
            comment,
            "",
        ])
    
    # 評価した点（evaluationから直接取得し、段落番号がある場合は表示）
    evaluation_strengths = evaluation.get("strengths", [])
    if evaluation_strengths:
        parts.extend([
            "### ✅ 評価した点",
            "",
        ])
        for strength in evaluation_strengths:
            if isinstance(strength, dict):
                category = strength.get("category", "")
                description = strength.get("description", "")
                para_nums = strength.get("paragraph_numbers", [])
                if category and description:
                    if para_nums:
                        parts.append(f"- **[{category}]** {description}（関連段落: {', '.join(map(str, para_nums))}）")
                    else:
                        parts.append(f"- **[{category}]** {description}")
                elif description:
                    if para_nums:
                        parts.append(f"- {description}（関連段落: {', '.join(map(str, para_nums))}）")
                    else:
                        parts.append(f"- {description}")
            elif isinstance(strength, str):
                parts.append(f"- {strength}")
        parts.append("")
    
    # 改善点（evaluationから直接取得し、段落番号がある場合は表示）
    evaluation_weaknesses = evaluation.get("weaknesses", [])
    if evaluation_weaknesses:
        parts.extend([
            "### ⚠️ 改善点",
            "",
        ])
        for weakness in evaluation_weaknesses:
            if isinstance(weakness, dict):
                category = weakness.get("category", "")
                description = weakness.get("description", "")
                para_nums = weakness.get("paragraph_numbers", [])
                suggestion = weakness.get("suggestion", "")
                if category and description:
                    if para_nums:
                        parts.append(f"- **[{category}]** {description}（関連段落: {', '.join(map(str, para_nums))}）")
                    else:
                        parts.append(f"- **[{category}]** {description}")
                    if suggestion:
                        parts.append(f"  - 💡 改善提案: {suggestion}")
                elif description:
                    if para_nums:
                        parts.append(f"- {description}（関連段落: {', '.join(map(str, para_nums))}）")
                    else:
                        parts.append(f"- {description}")
                    if suggestion:
                        parts.append(f"  - 💡 改善提案: {suggestion}")
            elif isinstance(weakness, str):
                parts.append(f"- {weakness}")
        parts.append("")
    
    # 重要なポイントがある場合（evaluation.txtの新しい出力形式）
    important_points = evaluation.get("important_points", [])
    if important_points:
        parts.extend([
            "---",
            "### 📌 重要な段落の評価",
            "",
        ])
        
        for point in important_points:
            para_num = point.get("paragraph_number", "?")
            parts.extend([
                f"#### 段落 {para_num}",
                "",
            ])
            
            if point.get("why_important"):
                parts.extend([
                    f"**重要性**: {point['why_important']}",
                    "",
                ])
            
            if point.get("what_is_good"):
                parts.extend([
                    "**✅ 十分に書けている点:**",
                    point["what_is_good"],
                    "",
                ])
            
            if point.get("what_is_lacking"):
                parts.extend([
                    "**⚠️ 不足している点:**",
                    point["what_is_lacking"],
                    "",
                ])
            
            parts.append("")
    
    # その他今後意識するべきこと
    future_considerations = evaluation.get("future_considerations", [])
    if future_considerations:
        parts.extend([
            "### 📋 その他今後意識するべきこと",
            "",
        ])
        for action in future_considerations:
            parts.append(f"- {action}")
        parts.append("")
    
    # 旧形式のサポート（後方互換性）
    if not evaluation and review_json.get("score") is not None:
        parts.extend([
            f"**点数: {review_json.get('score', 'N/A')}点**",
            f"",
        ])
        
        if review_json.get("strengths"):
            parts.extend([
                "### 良い点",
            ])
            for strength in review_json["strengths"]:
                parts.append(f"- {strength}")
            parts.append("")
        
        if review_json.get("weaknesses"):
            parts.extend([
                "### 改善点",
            ])
            for weakness in review_json["weaknesses"]:
                parts.append(f"- {weakness}")
            parts.append("")
        
        if review_json.get("next_actions"):
            parts.extend([
                "### 次にやること",
            ])
            for action in review_json["next_actions"]:
                parts.append(f"- {action}")
    
    return "\n".join(parts)


def _generate_dummy_review(subject: str) -> tuple[str, Dict[str, Any], str]:
    """ダミー講評を生成（APIキーが設定されていない場合）"""
    review_json = {
        "score": 60,
        "strengths": ["論点の拾い上げはできている"],
        "weaknesses": ["規範の定立が曖昧", "あてはめが薄い"],
        "next_actions": ["規範を要件ごとに箇条書き", "事実→評価語→結論の接続を明示"],
    }
    review_markdown = f"""
### 総評
科目: **{subject}**

**点数: 60点**

### 良い点
- 論点の拾い上げはできています

### 改善点
- 規範の定立が曖昧
- あてはめが薄い

### 次にやること
- 規範を要件ごとに箇条書き
- 事実→評価語→結論の接続を明示
""".strip()
    
    return review_markdown, review_json, "dummy"


def chat_about_review(
    submission_id: int,
    question: str,
    question_text: str,
    answer_text: str,
    review_markdown: str,
    chat_history: Optional[List[Dict[str, str]]] = None
) -> str:
    """
    講評に関する質問に答える
    
    Args:
        submission_id: 提出ID
        question: ユーザーの質問
        question_text: 問題文
        answer_text: 答案
        review_markdown: 講評（マークダウン形式）
        chat_history: チャット履歴（オプション）
    
    Returns:
        LLMからの回答
    """
    # APIキーが設定されていない場合はダミーを返す
    if not ANTHROPIC_API_KEY:
        return "申し訳ございませんが、現在LLM機能が利用できません。APIキーが設定されていないため、チャット機能を使用できません。"
    
    try:
        client = Anthropic(api_key=ANTHROPIC_API_KEY)
        
        # システムプロンプト
        system_prompt = """あなたは法律答案の講評を行う専門家です。ユーザーからの質問に対して、以下の情報を参照しながら丁寧に回答してください：
- 問題文
- 答案
- 既に生成された講評

講評の内容について詳しく説明したり、改善点を具体的にアドバイスしたり、ユーザーの疑問に答えてください。"""
        
        # メッセージ履歴を構築
        messages = []
        
        # 最初のメッセージ：コンテキスト情報を提供
        context_message = f"""以下の問題文、答案、講評について質問に答えてください。

【問題文】
{question_text}

【答案】
{answer_text}

【講評】
{review_markdown}

上記の情報を参照しながら、ユーザーの質問に答えてください。"""
        
        messages.append({
            "role": "user",
            "content": context_message
        })
        
        # チャット履歴を追加（最初のコンテキストメッセージの後）
        if chat_history:
            messages.extend(chat_history)
        
        # 現在の質問を追加
        messages.append({
            "role": "user",
            "content": question
        })
        
        # Claude APIにリクエスト
        message = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=4096,
            temperature=0.7,
            system=system_prompt,
            messages=messages
        )
        
        # レスポンスを取得
        answer = message.content[0].text
        
        return answer
        
    except Exception as e:
        # エラーが発生した場合
        print(f"チャット生成エラー: {e}")
        return f"申し訳ございませんが、エラーが発生しました: {str(e)}"


def free_chat(
    question: str,
    chat_history: Optional[List[Dict[str, str]]] = None
) -> str:
    """
    フリーチャット（文脈に縛られない汎用的なチャット）
    
    Args:
        question: ユーザーの質問
        chat_history: チャット履歴（オプション）
    
    Returns:
        LLMからの回答
    """
    # APIキーが設定されていない場合はダミーを返す
    if not ANTHROPIC_API_KEY:
        return "申し訳ございませんが、現在LLM機能が利用できません。APIキーが設定されていないため、チャット機能を使用できません。"
    
    try:
        client = Anthropic(api_key=ANTHROPIC_API_KEY)
        
        # システムプロンプト（汎用的なアシスタントとして動作）
        system_prompt = """あなたは親切で知識豊富なアシスタントです。ユーザーからの質問に対して、正確で分かりやすい回答を提供してください。
法律に関する質問については、可能な範囲で法的な観点から説明してください。
一般的な質問についても、丁寧に回答してください。"""
        
        # メッセージ履歴を構築
        messages = []
        
        # チャット履歴があれば追加
        if chat_history:
            messages.extend(chat_history)
        
        # 現在の質問を追加
        messages.append({
            "role": "user",
            "content": question
        })
        
        # Claude APIにリクエスト
        message = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=4096,
            temperature=0.7,
            system=system_prompt,
            messages=messages
        )
        
        # レスポンスを取得
        answer = message.content[0].text
        
        return answer
        
    except Exception as e:
        # エラーが発生した場合
        print(f"フリーチャット生成エラー: {e}")
        return f"申し訳ございませんが、エラーが発生しました: {str(e)}"
