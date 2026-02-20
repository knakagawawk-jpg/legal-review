# フリーチャット：LLMに渡すコンテキストの整理

## 1. レビューチャットのルール確認（参考にしたい点）

### 1.1 コンテキストの構成

- **常時ブロック**: 問題文、講評（全体）
- **条件付きブロック**: ユーザー入力に応じて「出題趣旨」「採点実感」「§N／指定段落付き答案・関連講評」を追加
- コンテキストは **毎回** そのときのユーザー入力とThreadの保持値から組み立て直し、**messages には保存しない**

### 1.2 メッセージ配列の形（review_chat）

1. **コンテキスト**（1本の user メッセージ）
2. **要約がある場合**: 「【これまでの会話の要約】」＋ conversation_summary を user メッセージで追加 → 直前ラリー → 以降の履歴
3. **要約がない場合**: 会話履歴をそのまま追加
4. **今回のユーザー発話**: 「ユーザーの質問: {QUESTION}」形式（`review_chat_user.txt`）

システムプロンプトは毎回 `review_chat_system.txt` を渡す。

### 1.3 システムプロンプトの内容（要点）

- **何が毎回／条件付きで渡されるか**を明示
- **参照情報の扱い**（例: Specified/Related は関係あることもないこともある、関係なければ無視してよい）
- **回答方針**: 根拠とする情報、要約の扱い、結論→理由→改善案、中立性・媚び不要など
- **フォールバック**: 該当箇所が渡されていない場合の案内文を末尾に付ける指示

### 1.4 会話履歴の扱い

- 5ターンごとにセグメント要約し、`conversation_summary` に追記
- 6ターン目以降は「要約 ＋ 直前ラリー ＋ それ以降」を渡してトークン節約

### 1.5 実装上の分離

- システムプロンプト: 外部ファイル（`review_chat_system.txt`）を main で読み、`llm_service.review_chat(system_prompt=..., messages=...)` に渡す
- ユーザー発話: テンプレート（`review_chat_user.txt`）で整形してから messages の末尾に追加

---

## 2. フリーチャットの現状

### 2.1 渡しているもの

| 項目 | 現状 |
|------|------|
| システムプロンプト | **llm_service.free_chat 内でハードコード**された短い汎用文（「親切で知識豊富なアシスタント…」）。**main で読み込んだ free_chat.txt は渡されておらず未使用**。 |
| メッセージ | `chat_history`（user/assistant の並び）＋ 今回の `question` のみ。コンテキスト用の別ブロックはなし。 |
| ユーザー発話の整形 | なし（生の question をそのまま末尾に追加）。 |

### 2.2 問題点

- **free_chat.txt が反映されていない**: 日本法学習者向け・スコープ・ガードレール・最重要方針などがプロンプトに書かれているが、API に渡されていない。
- **コンテキストの定義がない**: レビューチャットのように「何を常時／条件付きで渡すか」がドキュメント・コード上も明文化されていない。
- **会話履歴の工夫なし**: 要約や「要約＋直前ラリー＋以降」の構成は行っていない（長いスレッドでトークンが膨らむ可能性）。

---

## 3. フリーチャットへの移植案

### 3.1 方針

- レビューチャットの**構造**（システムプロンプトの渡し方・メッセージ配列の形・プロンプトの明文化）を参考にする。
- フリーチャットには「問題文・講評・出題趣旨・Specified/Related」は存在しないため、**コンテキストブロック**は「常時／条件付き」の**枠だけ**用意し、中身は「（現状）なし」または「将来の拡張用」とする。

### 3.2 修正内容案

#### A. システムプロンプトを確実に渡す（必須）

- **main.py**: `free_chat` 呼び出し時に、読み込んだ `free_chat.txt` の内容を `system_prompt` として渡す。
- **llm_service.free_chat**: 引数に `system_prompt: str` を追加し、呼び出し元から渡されたシステムプロンプトをそのまま `system=` に渡す。未渡しの場合は従来の短いフォールバックを使うか、または必須にして main のみから呼ぶ前提にする。

これにより、`free_chat.txt` に書いた役割・スコープ・ガードレール・最重要方針が実際に LLM に効くようにする。

#### B. コンテキストの明文化（ドキュメント＋コード）

- **常時ブロック**: フリーチャットでは「講評済み答案に紐づく情報」はない。現状は「常時コンテキストブロック」は設けず、**メッセージは「会話履歴 ＋ 今回のユーザー発話」のみ**でよい。
- **条件付きブロック**: 将来、例えば「ユーザーが条文番号を言及したら条文テキストを追加」などをする場合に、レビューチャットと同様に「条件付きでコンテキストを追加」する拡張ポイントをドキュメントに書いておく。
- **ドキュメント**: 本ドキュメント（または `docs/フリーチャット_LLM渡し情報の整理.md`）に「フリーチャットでLLMに渡すもの」を表形式でまとめる（システムプロンプトの出典、メッセージ配列の形、要約の有無など）。

#### C. メッセージ配列の形の統一（任意）

- レビューチャットと揃えるなら「今回のユーザー発話」を `free_chat_user.txt` のようなテンプレートで「ユーザーの質問: {QUESTION}」に整形してから末尾に追加する方法がある。現状のまま「生の question を追加」でも動作上は問題ないため、**優先度は低め**。テンプレート化する場合はプロンプトの一貫性と将来の拡張（例: 質問の前後にメタ情報を付与）のために有効。

#### D. 会話履歴の要約（将来検討）

- フリーチャットでも会話が長くなった場合、レビューチャットと同様に「5ターンごとに要約」「要約＋直前ラリー＋以降」を渡す方式を検討できる。
- 実装には Thread に `conversation_summary` / `summary_up_to_turn` を持たせるか、フリーチャット用に別カラムを用意する必要がある。**まずは A と B を実施し、必要になったら導入**でよい。

### 3.3 移植後の「フリーチャットでLLMに渡すもの」一覧（実装済み）

| 項目 | 内容 |
|------|------|
| システムプロンプト | `prompts/main/free_chat.txt` の内容を毎回 main で読み、`llm_service.free_chat(system_prompt=..., messages=...)` に渡す。 |
| メッセージ配列 | [ コンテキスト(user) ] → [ 要約(user)（あれば）＋直前ラリー＋以降の履歴 ] → [ 今回のユーザー発話(user) ]。コンテキストは「参照情報なし」の1本。 |
| ユーザー発話 | `free_chat_user.txt` で「ユーザーの質問: {QUESTION}」に整形して末尾に追加。 |
| 要約 | 5ターンごとにセグメント要約（`free_chat_summarize.txt`）。6ターン目以降は「要約＋直前ラリー＋以降」を渡してトークン節約。Thread の `conversation_summary` / `summary_up_to_turn` を利用。 |

### 3.4 実装済みタスク

1. **llm_service.free_chat**: `review_chat` と同様に `(system_prompt, messages)` を受け取り、そのまま API に渡す形に変更済み。
2. **main.py**: フリーチャット分岐で、[コンテキスト]→[要約＋直前ラリー＋以降]→[ユーザー発話]を組み立て、`free_chat.txt` を system、`_build_free_chat_user_prompt_text` で整形した発話を末尾に追加して呼び出し。
3. **5ターンごと要約**: `thread.type == "free_chat"` のときも要約を実行し、`summarize_conversation_segment(..., prompt_name="free_chat_summarize")` で `free_chat_summarize.txt` を使用。
4. **プロンプトファイル**: `free_chat_user.txt`、`free_chat_summarize.txt` を追加済み。

---

## 5. フリーチャット：prompts/main 内の各ファイルの取得・渡し・使用

フリーチャットで使う `prompts/main` 内のファイルは次の3つ。取得場所・渡し方・使われ方を整理する。

### 5.1 一覧

| ファイル | 取得場所 | 取得方法 | 渡し方 | 使われ方 |
|----------|----------|----------|--------|----------|
| **free_chat.txt** | `app/main.py` | `create_message` 内のフリーチャット分岐で、`Path(__file__).parent.parent / "prompts" / "main" / "free_chat.txt"` を `read_text(encoding="utf-8").strip()` で読み込み | 変数 `system_prompt` として `llm_service.free_chat(system_prompt=system_prompt, messages=messages_for_llm)` の第1引数で渡す | `llm_service.free_chat` 内で Anthropic API の `client.messages.create(..., system=system_prompt or "", messages=messages)` にそのまま渡され、**LLMのシステムプロンプト**として使われる（役割・スコープ・ガードレール等の指示） |
| **free_chat_user.txt** | `app/main.py` | `_build_free_chat_user_prompt_text(question)` 内で `_load_prompt_text("free_chat_user")` を呼ぶ。`_load_prompt_text` は `prompts/main/{prompt_name}.txt` を読み、無ければ空文字を返す | テンプレート文字列として取得し、`{QUESTION}` を `message_data.content`（今回のユーザー発話）で置換した文字列を返す。その返り値を `messages_for_llm` の**末尾の user メッセージ**として追加し、`free_chat(system_prompt, messages=messages_for_llm)` に渡す | メッセージ配列の**最後の1本**（「ユーザーの質問: …」形式）として LLM に渡され、**今回のユーザー発話**として解釈される |
| **free_chat_summarize.txt** | `app/llm_service.py` | `summarize_conversation_segment(messages, prompt_name="free_chat_summarize")` 呼び出し時に、`_load_prompt_template(prompt_name)` で読み込み。`_load_prompt_template` は `PROMPTS_DIR / "main" / f"{template_name}.txt"`（＝`prompts/main/free_chat_summarize.txt`）を `read_text(encoding="utf-8")` で読む。ファイルが無い場合はフォールバックの固定文を使用 | テンプレートの `{CONVERSATION}` を、セグメントの user/assistant メッセージを「ユーザー:」「アシスタント:」形式で連結した文字列で置換し、1本の user メッセージとして `client.messages.create(messages=[{"role": "user", "content": prompt}])` に渡す | **要約用の1回限りのLLM呼び出し**のプロンプトとして使われる。返ってきた応答が「セグメント要約」となり、main 側で `thread.conversation_summary` に追記され、6ターン目以降の通常チャットで「【これまでの会話の要約】」として messages に含まれる |

### 5.2 取得元のパス・関数

- **free_chat.txt**  
  - パス: `main.py` の `__file__` から相対で `../prompts/main/free_chat.txt`（実体は `law-review/prompts/main/free_chat.txt`）  
  - 関数: `create_message` 内の `thread.type != "review_chat"` の分岐で直接 `Path(...).read_text(...)`。共通の `_load_prompt_text` は使っていない。

- **free_chat_user.txt**  
  - パス: `_load_prompt_text("free_chat_user")` により `prompts/main/free_chat_user.txt`（`main.py` の `__file__` 基準で `../prompts/main/free_chat_user.txt`）  
  - 関数: `_load_prompt_text`（`app/main.py` 定義）。存在しなければ空文字で、呼び出し側でフォールバック「ユーザーの質問:\n{QUESTION}」を使用。

- **free_chat_summarize.txt**  
  - パス: `llm_service.py` の `PROMPTS_DIR`（＝`Path(__file__).parent.parent / "prompts"`）＋ `"main" / "free_chat_summarize.txt"`  
  - 関数: `_load_prompt_template("free_chat_summarize")`（`app/llm_service.py` 定義）。ファイルが無い場合は「講評チャットの会話の一部です…」のフォールバック文を使用。

### 5.3 呼び出しフロー（フリーチャット1ターン）

1. ユーザーがメッセージ送信 → `POST /v1/threads/{thread_id}/messages` → `create_message`
2. `thread.type == "free_chat"` のとき:
   - **free_chat.txt** を上記パスで読み、`system_prompt` に格納。
   - コンテキスト1本＋要約（あれば）＋履歴を組み立て、**free_chat_user.txt** で整形した「今回のユーザー発話」を末尾に追加 → `messages_for_llm`。
   - `llm_free_chat(system_prompt=system_prompt, messages=messages_for_llm)` を呼ぶ → **free_chat.txt** が system に、**free_chat_user.txt** が messages の最後に使われる。
3. 5の倍数ターン完了時: `summarize_conversation_segment(segment_list, prompt_name="free_chat_summarize")` を呼ぶ → **free_chat_summarize.txt** が要約用リクエストのプロンプトとして使われ、得られた要約が `thread.conversation_summary` に追記される。

---

## 6. まとめ

- **レビューチャット**: コンテキスト（常時／条件付き）を毎回組み立て、要約で履歴を圧縮し、システムプロンプトとユーザー発話をテンプレートで外部化している。
- **フリーチャット**: 現状はシステムプロンプトが llm_service 内の固定文で、free_chat.txt が未使用。コンテキストの明文化もない。
- **移植案**: まず「システムプロンプトを main から渡し、free_chat.txt を確実に効かせる」ことを必須とする。その上で、コンテキストの枠とメッセージ配列の形をドキュメントで明文化し、必要に応じてユーザー発話のテンプレート化や会話要約を検討する。
