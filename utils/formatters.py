"""フォーマッター関数"""


def int_to_year_str(year_int: int) -> str:
    """年度を文字列に変換（R7, H30など）
    
    Args:
        year_int: 年度（整数、例: 2025）
    
    Returns:
        年度の文字列表現（例: "R7", "H30"）
    """
    if year_int >= 2019:
        return f"R{year_int - 2018}"
    elif year_int >= 1989:
        return f"H{year_int - 1988}"
    else:
        return str(year_int)


def year_str_to_int(year_str: str) -> int:
    """年度文字列を整数に変換（R7 -> 2025, H30 -> 2018など）
    
    Args:
        year_str: 年度の文字列表現（例: "R7", "H30"）
    
    Returns:
        年度（整数）
    """
    if year_str.startswith("R"):
        return 2018 + int(year_str[1:])
    elif year_str.startswith("H"):
        return 1988 + int(year_str[1:])
    else:
        try:
            return int(year_str)
        except ValueError:
            return None
