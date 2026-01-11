#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
整形されたJSONファイルからデータベースを更新

既存の問題を削除して、整形されたJSONファイルから再インポート
"""

import json
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))

from app.db import SessionLocal
from app.models import Problem

def year_to_int(year_str: str) -> int:
    """年度文字列を整数に変換"""
    if year_str.startswith("R"):
        reiwa_num = int(year_str[1:])
        return 2018 + reiwa_num
    elif year_str.startswith("H"):
        heisei_num = int(year_str[1:])
        return 1988 + heisei_num
    else:
        try:
            return int(year_str)
        except:
            raise ValueError(f"年度の形式が不正です: {year_str}")

def update_db_from_json(json_dir: Path):
    """整形されたJSONファイルからデータベースを更新"""
    db = SessionLocal()
    
    try:
        # JSONファイルを取得
        json_files = list(json_dir.glob("*.json"))
        
        if not json_files:
            print(f"JSONファイルが見つかりませんでした: {json_dir}")
            return
        
        print(f"見つかったJSONファイル: {len(json_files)}件")
        print("-" * 60)
        
        # 既存の問題を削除（予備試験 R7のみ）
        deleted = db.query(Problem).filter(
            Problem.exam_type == "予備試験",
            Problem.year == 2025
        ).delete()
        db.commit()
        print(f"既存の問題を削除: {deleted}件")
        print("-" * 60)
        
        imported_count = 0
        error_count = 0
        
        for json_file in json_files:
            try:
                # JSONファイルを読み込み
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                year_str = data.get("year", "")
                exam_type = data.get("exam_type", "")
                subject = data.get("subject", "")
                text = data.get("text", "")
                source_pdf = data.get("source_pdf", "")
                
                # 年度を整数に変換
                try:
                    year = year_to_int(year_str)
                except ValueError as e:
                    print(f"エラー: {json_file.name} - {e}")
                    error_count += 1
                    continue
                
                # 試験種別を正規化
                if exam_type == "予備":
                    exam_type = "予備試験"
                elif exam_type == "司法":
                    exam_type = "司法試験"
                
                # 問題を作成
                problem = Problem(
                    exam_type=exam_type,
                    year=year,
                    subject=subject,
                    question_text=text,
                    pdf_path=source_pdf,
                )
                
                db.add(problem)
                db.commit()
                
                print(f"登録: {json_file.name}")
                print(f"  {exam_type} {year}年 {subject}")
                imported_count += 1
                
            except Exception as e:
                db.rollback()
                print(f"エラー: {json_file.name} - {str(e)}")
                error_count += 1
        
        print("\n" + "=" * 60)
        print(f"処理完了:")
        print(f"  登録: {imported_count}件")
        print(f"  エラー: {error_count}件")
        
    finally:
        db.close()

if __name__ == "__main__":
    # JSONファイルのディレクトリ
    JSON_DIR = BASE_DIR / "json_data" / "予備試験" / "R7"
    
    if not JSON_DIR.exists():
        print(f"エラー: ディレクトリが見つかりません: {JSON_DIR}")
        sys.exit(1)
    
    update_db_from_json(JSON_DIR)
