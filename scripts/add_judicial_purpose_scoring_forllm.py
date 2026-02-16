# -*- coding: utf-8 -*-
"""
司法試験R1のpurposeおよびscoring_notesに、
入れ子構造のpurpose_forllm / scoring_notes_forllmを追加する。

構造: BQ1 (第1問), BQ2 (第2問) を親とし、
各BQ内で common / q1 / q2 / q3 に分割。
commonは途中でも出現し得る。
"""
import json
import re
import os

R1_DIR = r"c:\Users\tvxqt\.shihou-zyuken2601\law-review\data\json\judicial_exam\R1"


def process_text(text):
    """
    purpose または scoring_notes を BQ・設問単位で分割する。
    返り値: {"BQ1": {"segments": [...]}, "BQ2": {"segments": [...]}} または
           {"BQ1": {"segments": [...]}} のみ
    """
    if not text or not text.strip():
        return {}

    text = text.strip()
    result = {}

    # 第２問があるかチェック（〔第２問〕または ⑵ 第２問 等）
    has_bq2 = bool(re.search(r'(?:〔第[２2二]問〕|⑵\s*第[２2二]問)', text))

    if has_bq2:
        # 第１問と第２問で分割（〔第２問〕または ⑵ 第２問）
        split_match = re.search(r'(?:〔第[２2二]問〕|⑵\s*第[２2二]問)', text)
        if split_match:
            split_pos = split_match.start()
            bq1_raw = text[:split_pos].strip()
            bq2_raw = text[split_pos:].strip()
        else:
            parts = re.split(r'(〔第[２2二]問〕)', text, 1)
            bq1_raw = parts[0].strip()
            bq2_raw = (parts[1] + parts[2]).strip() if len(parts) >= 3 else ""

        # 第１問ヘッダーを除去
        bq1_content = re.sub(r'^(?:〔第[１1一]問〕|⑴\s*第[１1一]問)\s*', '', bq1_raw)
        bq2_content = re.sub(r'^(?:〔第[２2二]問〕|⑵\s*第[２2二]問)\s*', '', bq2_raw)

        result["BQ1"] = {"segments": split_bq_into_segments(bq1_content)}
        result["BQ2"] = {"segments": split_bq_into_segments(bq2_content)}
    else:
        # 第１問のみ
        bq1_content = re.sub(r'^〔第[１1一]問〕\s*', '', text)
        result["BQ1"] = {"segments": split_bq_into_segments(bq1_content)}

    return result


def split_bq_into_segments(bq_text):
    """
    BQ内のテキストを 設問１, 設問２, 設問３ 等で分割。
    マーカーに属さない部分は common（冒頭・途中・末尾いずれでも可）。
    """
    if not bq_text.strip():
        return []

    segments = []
    # 設問マーカーを検出: 設問１は, 設問２は, 設問３は 等（全角１２３４・半角1234・漢数字三四）
    # 設問２(1), 設問２⑴, 設問２⑵ 等の小問も検出
    pattern = r'(?=設問[1-4１-４三四][はについて]*(?:[（(][ｱｲ１２12a][）)])?)'
    parts = re.split(pattern, bq_text)

    i = 0
    while i < len(parts):
        part = parts[i].strip()
        if not part:
            i += 1
            continue

        # 設問Nは または 設問N(1) 等で始まるか
        q_match = re.match(
            r'設問([1-4１-４三四])[はについて]*(?:[（(]([ｱｲ１２12a])[）)])?\s*(.*)',
            part,
            re.DOTALL
        )

        if q_match:
            num_map = {'１': '1', '２': '2', '３': '3', '４': '4', '三': '3', '四': '4'}
            q_num = num_map.get(q_match.group(1), q_match.group(1))
            sub = q_match.group(2)
            # 設問2(1), 設問2⑴ 等は q2_1 と q2_2 に
            if sub and q_num == '2':
                sub_map = {'ｱ': '1', 'ｲ': '2', '１': '1', '２': '2', '1': '1', '2': '2', 'a': '1'}
                seg_type = f"q2_{sub_map.get(sub, '1')}"
            else:
                seg_type = f"q{q_num}"

            segments.append({"type": seg_type, "text": part})
        else:
            # common（設問に属さない部分）
            segments.append({"type": "common", "text": part})

        i += 1

    # 連続する common をマージ
    merged = []
    for s in segments:
        if merged and merged[-1]["type"] == "common" and s["type"] == "common":
            merged[-1]["text"] = (merged[-1]["text"] + "\n" + s["text"]).strip()
        else:
            merged.append(s)

    return merged


def main():
    dir_path = R1_DIR
    if not os.path.isdir(dir_path):
        print(f"Directory not found: {dir_path}")
        return

    files = [f for f in os.listdir(dir_path) if f.endswith('.json')]
    print(f"Processing {len(files)} files...")

    for filename in sorted(files):
        filepath = os.path.join(dir_path, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"  Error reading {filename}: {e}")
            continue

        modified = False

        if "purpose" in data:
            try:
                data["purpose_forllm"] = process_text(data["purpose"])
                modified = True
            except Exception as e:
                print(f"  Error processing purpose in {filename}: {e}")

        if "scoring_notes" in data:
            try:
                data["scoring_notes_forllm"] = process_text(data["scoring_notes"])
                modified = True
            except Exception as e:
                print(f"  Error processing scoring_notes in {filename}: {e}")

        if modified:
            try:
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"  Updated: {filename}")
            except Exception as e:
                print(f"  Error writing {filename}: {e}")

    print("Done.")


if __name__ == "__main__":
    main()
