# YourPage 科目別ノート DB仕様（改訂案）

## 1. 目的

YourPage の科目別ノート機能について、
- 科目内で複数ノートブックを作成可能
- ノートブック内に複数の note_section（項目名のみ）
- note_section ごとに複数の note_page（本文）
- note_page の項目名（タイトル）は任意

という要件を満たすための DB 仕様を定義する。

> 備考: docs 配下のドキュメントは参照しない。

## 2. 推奨データモデル（ER 構成）

```
Users 1 ── N Subjects 1 ── N Notebooks 1 ── N NoteSections 1 ── N NotePages
```

- **Subjects（科目）**を追加し、1科目に複数のノートブックを紐付ける。
- 既存の Notebook → NoteSection → NotePage の階層は維持する。

## 3. テーブル定義（案）

### 3.1 subjects（科目）

| カラム | 型 | NULL | 説明 | 制約/Index |
|---|---|---|---|---|
| id | integer | NO | PK | PK |
| user_id | integer | NO | 所有ユーザー | FK(users.id), index |
| name | varchar(200) | NO | 科目名 | unique(user_id, name) |
| created_at | timestamp | NO | 作成日時 | |
| updated_at | timestamp | NO | 更新日時 | |

**ポイント**
- ユーザーごとに科目を持つ運用を想定。
- `unique(user_id, name)` で同一ユーザー内の重複科目名を防止。

### 3.2 notebooks（ノートブック）

| カラム | 型 | NULL | 説明 | 制約/Index |
|---|---|---|---|---|
| id | integer | NO | PK | PK |
| user_id | integer | NO | 所有ユーザー | FK(users.id), index |
| subject_id | integer | NO | 所属科目 | FK(subjects.id), index |
| title | varchar(200) | NO | ノートブック名 | |
| description | text | YES | 説明 | |
| color | varchar(20) | YES | カラーコード | |
| created_at | timestamp | NO | 作成日時 | |
| updated_at | timestamp | NO | 更新日時 | |

**ポイント**
- 1科目に複数ノートブックを作成可能。
- 既存の Notebook 構造に `subject_id` を追加。

### 3.3 note_sections（項目名のみ）

| カラム | 型 | NULL | 説明 | 制約/Index |
|---|---|---|---|---|
| id | integer | NO | PK | PK |
| notebook_id | integer | NO | 親ノートブック | FK(notebooks.id), index |
| title | varchar(200) | NO | セクション名（項目名） | |
| display_order | integer | NO | 表示順 | index(notebook_id, display_order) |
| created_at | timestamp | NO | 作成日時 | |
| updated_at | timestamp | NO | 更新日時 | |

**ポイント**
- 本文は持たせず、項目名のみで構成。

### 3.4 note_pages（本文）

| カラム | 型 | NULL | 説明 | 制約/Index |
|---|---|---|---|---|
| id | integer | NO | PK | PK |
| section_id | integer | NO | 親セクション | FK(note_sections.id), index |
| title | varchar(200) | YES | ページの項目名（任意） | |
| content | text | YES | 本文（Markdown 等） | |
| display_order | integer | NO | 表示順 | index(section_id, display_order) |
| created_at | timestamp | NO | 作成日時 | |
| updated_at | timestamp | NO | 更新日時 | |

**ポイント**
- ページの項目名（タイトル）は任意のため `NULL` 可。
- 本文は `content` に格納。

## 4. API / クエリ設計の要点

- ユーザー単位で `Subjects` / `Notebooks` を取得する。
- 科目 → ノートブック → セクション → ページの順に関連を取得。
- ノートページの `title` が `NULL` の場合は、UI 側で「無題」等の表示で補完。

## 5. 既存モデルへの影響（差分イメージ）

- 新規: `subjects` テーブル追加。
- 変更: `notebooks` に `subject_id` 追加。
- 変更: `note_pages.title` を nullable に変更（任意項目名）。

## 6. マイグレーション方針（概要）

1. `subjects` テーブルを追加。
2. `notebooks` に `subject_id` カラム追加。
3. 既存 Notebook をどの Subject に紐付けるか移行計画を決定。
4. `note_pages.title` を nullable に変更。

---

以上の仕様に沿って実装を進めれば、
- **科目内で複数ノートブック作成**
- **セクションは項目名のみ**
- **ページは本文 + 項目名（任意）**

を満たす構成となる。