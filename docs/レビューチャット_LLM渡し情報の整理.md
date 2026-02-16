# レビューチャット：LLMに渡す情報の整理

## 概要

講評チャットでは、**毎回**コンテキストを組み立ててLLMに渡す。内容は「常時含めるブロック」と「ユーザー入力に応じた条件付きブロック」で決まる。2回目以降は会話履歴（または要約＋直前ラリー＋以降）も渡す。

---

## コンテキストの構成（毎回組み立て）

### 常時含めるブロック

| ブロック | 内容 |
|----------|------|
| **【問題文】** | 当該レビューの問題文（OfficialQuestion.text または Review.custom_question_text） |
| **【講評（全体）】** | 講評JSONの `overall_review` のみ（全文ではなくこの部分だけ） |

### 条件付きで含めるブロック

| 条件 | ブロック | 備考 |
|------|----------|------|
| ユーザー入力に「**出題趣旨**」が含まれる | **【出題趣旨／参考文章】** | `review_chat_context.txt` の PURPOSE_TEXT に相当 |
| ユーザー入力に「**採点実感**」が含まれる | **【採点実感】** | GRADING_IMPRESSION_TEXT に相当 |
| ユーザー入力に「**§N**」または「**第N段落**」が含まれる、**または**「§N を含んだ発話」の**次回・次々回** | **【指定段落付き答案（Specified）】** と **【指定段落に関連する講評（Related）】** | 段落番号は「今回の入力」から検出。なければ Thread に保持した `last_section_paragraph_numbers` を使用（`current_turn <= last_section_mention_turn + 2` のとき） |

- **§N の持続**: §N/第N段落を含んだユーザー発話があったターンを T とする。T、T+1、T+2 の3ターン分、同じ段落番号で Specified/Related を渡す。T+1・T+2 で新しい §〇 が含まれていれば、その番号に更新する。
- **検出対象**: 「§N」（§の直後に数字）と「第N段落」のみ。スペース入りや ¶ 等は対象外。
- **Specified**: 各 N について §(N-5)～§(N+5) を clamp し、複数 N の範囲をマージ。重複は繋げ、隙間は「……」でつないでワンブロックにする。答案は DB 上の `$$[N]` 形式から抽出。
- **Related**: 講評JSONの strengths / weaknesses / important_points / future_considerations のうち、`paragraph_numbers` または `paragraph_number` にいずれかの N を含む項目を、重複なくひとまとまりで渡す。

---

## 会話履歴の渡し方（2回目以降）

- **要約なし**: 2～4ターン目は、これまでの会話履歴（user/assistant の並び）をそのまま `chat_history` としてコンテキストの後に付与。
- **要約あり**: 5ターン目が終わった時点で、1～5ターンのやり取りを要約し、Thread の `conversation_summary` に保存。6ターン目以降は「**要約** ＋ **直前ラリー**（要約に含めた最後の1往復、例: user_5, assistant_5）＋ **それ以降のやり取り**」を渡す。
- **5の倍数**: 10ターン目終了時は 6～10 ターンを要約して `conversation_summary` に追記。11ターン目以降は「要約(1～5)＋要約(6～10)＋直前ラリー(user_10, assistant_10)＋11ターン目以降」となる。15, 20... も同様。
- ターン数は 1-indexed。`current_turn = (len(chat_history) // 2) + 1`。

---

## LLMに渡るメッセージ配列の形

1. **コンテキスト**（1本の user メッセージ）  
   - 上記「コンテキストの構成」で組み立てた文字列。
2. **要約がある場合**  
   - 「【これまでの会話の要約】」＋ `conversation_summary` を 1本の user メッセージとして追加。  
   - 続けて、要約した最後の1ラリー（例: user_5, assistant_5）をそのまま追加。  
   - さらに、そのターンより後の会話履歴をすべて追加。
3. **要約がない場合**  
   - 会話履歴（`chat_history`）をそのまま追加。
4. **今回のユーザー発話**  
   - 「ユーザーの質問: {QUESTION}」形式（`review_chat_user.txt`）で末尾に追加。

システムプロンプトは毎回 `review_chat_system.txt` を渡す。

---

## システムプロンプトでの指示（要点）

- 毎回渡されるのは「問題文」と「講評（全体）」で、質問内容に応じて出題趣旨・採点実感・Specified/Related が含まれることがある。
- **Specified/Related**: ユーザーの質問に関係しているかもしれないとして機械的に抽出して渡しているだけなので、関係あることもないこともある。必要に応じて参照し、関係ないと判断したら無視してよい。
- **該当箇所がないとき**: ユーザーが答案や講評の特定箇所について質問しているのに Specified/Related が渡されておらず、適切に回答できない場合は、回答の**末尾**に次の一文を付ける。「すみませんが、該当箇所を確認できません。該当箇所をコピペするか、答案左の§記号または講評の該当箇所をクリックすることで、入力に含めてください。」

---

## 実装個所

### エントリポイント

| ファイル | 内容 |
|----------|------|
| `app/main.py` | `create_message`（`POST /v1/threads/{thread_id}/messages`）。ユーザー発話保存 → 履歴取得 → review_chat 分岐でコンテキスト・メッセージ組み立て → `llm_service.review_chat` 呼び出し |

### コンテキスト取得・組み立て

| ファイル | 関数・処理 | 内容 |
|----------|------------|------|
| `app/main.py` | `_get_review_chat_context_by_review_id` | Review と OfficialQuestion / UserReviewHistory から問題文・出題趣旨・採点実感・講評JSON・**答案文（answer_text）** を取得。戻りは 5 要素。 |
| `app/main.py` | `_build_review_chat_context_text` | 常時: 問題文、講評（全体）。条件付き: 出題趣旨、採点実感、Specified、Related。`paragraph_numbers_override` で「次回・次々回」用の段落番号を渡せる。 |
| `app/main.py` | create_message 内 | §N/第N段落の検出と、`last_section_mention_turn` / `last_section_paragraph_numbers` の更新。`paragraph_numbers_override` の決定（今回の入力 or 保持値）。 |

### 段落検出・Specified/Related 抽出（llm_service）

| ファイル | 関数 | 内容 |
|----------|------|------|
| `app/llm_service.py` | `extract_paragraph_numbers_from_user_input` | 「§N」「第N段落」を正規表現で検出し、段落番号のリストを返す。 |
| `app/llm_service.py` | `_parse_marked_answer_paragraphs` | 答案の `$$[N]` 行をパースして (段落番号, 内容) のリストを返す。 |
| `app/llm_service.py` | `extract_specified_text_from_answer` | 段落番号リストと window=5 で §(N-5)～§(N+5) を clamp。複数 N の範囲をマージし、隙間は「……」でつなぐ。 |
| `app/llm_service.py` | `get_related_review_json_items` | 講評JSONから paragraph_numbers / paragraph_number に指定番号を含む項目を重複なくリストで返す。 |

### 要約

| ファイル | 内容 |
|----------|------|
| `app/main.py` | 5の倍数ターン完了後、`summarize_conversation_segment` でセグメント要約を取得し、`thread.conversation_summary` に追記。`thread.summary_up_to_turn` を更新。 |
| `app/llm_service.py` | `summarize_conversation_segment(messages)`。プロンプトは `review_chat_summarize.txt`（疑問・観点、行った回答、残っている論点を整理）。 |
| `prompts/main/review_chat_summarize.txt` | 要約用プロンプト。 |

### プロンプトファイル

| パス | 役割 |
|------|------|
| `prompts/main/review_chat_system.txt` | システムプロンプト（役割・回答方針・Specified/Related の説明・該当箇所がないときの末尾文・Markdown 等）。 |
| `prompts/main/review_chat_user.txt` | 「ユーザーの質問: {QUESTION}」。毎回のユーザー発話をこの形で末尾の user メッセージにする。 |
| `prompts/main/review_chat_context.txt` | 現在はコンテキストはコード内でブロック連結して組み立てているため、テンプレートとしては未使用（互換用に残している場合あり）。 |
| `prompts/main/review_chat_summarize.txt` | 会話セグメント要約用。 |

### DB（Thread）

| カラム | 用途 |
|--------|------|
| `conversation_summary` | セグメント要約の連結（【1～5ターンの要約】…【6～10ターンの要約】…）。 |
| `summary_up_to_turn` | 要約がカバーしている最後のターン（5, 10, 15...）。 |
| `last_section_mention_turn` | 最後に §N/第N段落 が含まれたユーザー発話のターン。 |
| `last_section_paragraph_numbers` | そのときの段落番号の JSON 配列文字列（例: `"[1,3,5]"`）。 |

マイグレーション: `db_design/threads_conversation_summary_migration.sql`。

### LLM呼び出し

| ファイル | 内容 |
|----------|------|
| `app/llm_service.py` | `review_chat(system_prompt, messages, ...)`。Anthropic messages API に `system` と `messages` をそのまま渡す。 |

---

## 注意点

- コンテキストは **messages には保存しない**（DB に書くのは user/assistant のやり取りのみ）。毎回、そのときのユーザー入力と Thread の保持値から組み立て直す。
- Specified/Related は「関係あるかもしれない」という理由で機械抽出しているだけなので、LLM には関係ある/ない両方あり得ることをプロンプトで明示している。
- 該当箇所が分からないときは、プロンプトに従い末尾に案内文を付けるよう指示している。
