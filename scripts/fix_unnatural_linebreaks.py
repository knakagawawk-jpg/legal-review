# -*- coding: utf-8 -*-
"""
不自然な改行を削除するスクリプト
- PDFページ番号（- 30 -, -6 5- など）による単語の分割を修正
- /n の誤記を \n に修正
- 数字・記号直後の不自然な改行を削除（例: ５５％\nは → ５５％は）
"""
import json
import re
from pathlib import Path


def fix_unnatural_linebreaks(text: str) -> str:
    if not isinstance(text, str):
        return text

    # 1. /n を \n に修正
    text = text.replace("/n", "\n")

    # 2. PDFページ番号パターンを削除（前後の改行も含めて削除し、テキストを結合）
    # - 30 -, - 31 -, - 32 - 形式
    # -6 5-, -6 6-, -5 7- 形式（数字 数字）
    page_pattern = re.compile(
        r"\n\s*-\s*\d+(?:\s+\d+)?\s*-\s*\n",
        re.UNICODE,
    )
    text = page_pattern.sub("", text)

    # 3. 行末のページ番号（次の行が続く場合）: "正当\n- 30 -化" → "正当化"
    # パターン: 改行 + ページ番号（次の文字の直前に来る）
    page_inline = re.compile(
        r"\n\s*-\s*\d+(?:\s+\d+)?\s*-\s*",
        re.UNICODE,
    )
    text = page_inline.sub("", text)

    # 4. 数字・記号直後の不自然な改行（％\nは、数字\nは など）
    # ％の直後の改行+は
    text = re.sub(r"％\s*\n\s*は", "％は", text)

    return text


def process_json_file(filepath: Path) -> bool:
    """JSONファイルを処理し、修正があればTrueを返す"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  読み込みエラー: {e}")
        return False

    modified = False
    for key in ("text", "purpose", "scoring_notes"):
        if key in data and data[key]:
            original = data[key]
            fixed = fix_unnatural_linebreaks(original)
            if original != fixed:
                data[key] = fixed
                modified = True

    if modified:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    return False


def main():
    base = Path(__file__).resolve().parent.parent
    json_dir = base / "data" / "json" / "judicial_exam"
    if not json_dir.exists():
        print(f"ディレクトリが見つかりません: {json_dir}")
        return

    files = list(json_dir.rglob("*.json"))
    updated = 0
    for fp in sorted(files):
        if process_json_file(fp):
            updated += 1
            print(f"更新: {fp.relative_to(base)}")
    print(f"\n完了: {updated} ファイルを更新しました")


if __name__ == "__main__":
    main()
