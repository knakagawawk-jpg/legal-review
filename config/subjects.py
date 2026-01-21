"""
科目マッピング定義（1-18）
バックエンドとフロントエンドで共通の定義
"""

# 科目ID → 科目名のマッピング（1-18）
SUBJECT_MAP = {
    1: "憲法",
    2: "行政法",
    3: "民法",
    4: "商法",
    5: "民事訴訟法",
    6: "刑法",
    7: "刑事訴訟法",
    8: "一般教養科目",
    9: "実務基礎（民事）",
    10: "実務基礎（刑事）",
    11: "労働法",
    12: "倒産法",
    13: "租税法",
    14: "経済法",
    15: "知的財産法",
    16: "環境法",
    17: "国際関係法（公法系）",
    18: "国際関係法（私法系）",
}

# 科目名 → 科目IDの逆マッピング
SUBJECT_NAME_TO_ID = {name: id for id, name in SUBJECT_MAP.items()}

# 科目IDのリスト（表示順序）
SUBJECT_IDS = list(SUBJECT_MAP.keys())

# 科目名のリスト（表示順序、FIXED_SUBJECTSと同じ）
SUBJECT_NAMES = list(SUBJECT_MAP.values())


def get_subject_name(subject_id: int) -> str:
    """科目IDから科目名を取得"""
    return SUBJECT_MAP.get(subject_id, "不明")


def get_subject_id(subject_name: str) -> int | None:
    """科目名から科目IDを取得"""
    if not subject_name:
        return None
    # "商 法" のような空白混入や "(民事)" のような半角括弧を吸収
    s = "".join(str(subject_name).split())
    s = s.replace("(", "（").replace(")", "）")
    v = SUBJECT_NAME_TO_ID.get(s)
    if v is not None:
        return v

    # かっこ無しの揺れ（例: "実務基礎民事"）
    s2 = s.replace("（", "").replace("）", "")
    for name, sid in SUBJECT_NAME_TO_ID.items():
        if name.replace("（", "").replace("）", "") == s2:
            return sid
    return None


def is_valid_subject_id(subject_id: int) -> bool:
    """科目IDが有効かチェック（1-18）"""
    return 1 <= subject_id <= 18
