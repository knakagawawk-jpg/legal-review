# -*- coding: utf-8 -*-
"""JSONファイルをインデント付きで再保存"""
import json
import os
import glob

R1_DIR = r"c:\Users\tvxqt\.shihou-zyuken2601\law-review\data\json\preliminary_exam\R1"

for filepath in glob.glob(os.path.join(R1_DIR, "*.json")):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Formatted:", os.path.basename(filepath))
