#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
JSONファイルからデータベースに問題を登録

JSON構造:
{
    "year": "R7",
    "exam_type": "予備",
    "subject": "科目名",
    "text": "問題文テキスト",
    "source_pdf": "PDFファイルのパス"
}
"""

import json
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))

from app.db import SessionLocal
from app.models import Problem, ProblemMetadata, ProblemDetails

def year_to_int(year_str: str) -> int:
    """年度文字列を整数に変換
    
    例: "R7" -> 2025, "H30" -> 2018
    """
    if year_str.startswith("R"):
        # 令和: R1 = 2019, R2 = 2020, ...
        reiwa_num = int(year_str[1:])
        return 2018 + reiwa_num
    elif year_str.startswith("H"):
        # 平成: H1 = 1989, H30 = 2018
        heisei_num = int(year_str[1:])
        return 1988 + heisei_num
    else:
        # 数値として解釈を試みる
        try:
            return int(year_str)
        except:
            raise ValueError(f"年度の形式が不正です: {year_str}")

def import_json_files(json_dir: Path):
    """JSONファイルをデータベースに登録"""
    db = SessionLocal()
    
    try:
        # JSONファイルを取得
        json_files = list(json_dir.glob("*.json"))
        
        if not json_files:
            print(f"JSONファイルが見つかりませんでした: {json_dir}")
            return
        
        print(f"見つかったJSONファイル: {len(json_files)}件")
        print("-" * 60)
        
        imported_count = 0
        skipped_count = 0
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
                purpose = data.get("purpose", "")  # 出題趣旨を追加
                
                # 年度を整数に変換
                try:
                    year = year_to_int(year_str)
                except ValueError as e:
                    print(f"エラー: {json_file.name} - {e}")
                    error_count += 1
                    continue
                
                # 試験種別を正規化（"予備" -> "予備試験"）
                if exam_type == "予備":
                    exam_type = "予備試験"
                elif exam_type == "司法":
                    exam_type = "司法試験"
                
                # 既存のメタデータをチェック（新しい構造）
                existing_metadata = db.query(ProblemMetadata).filter(
                    ProblemMetadata.exam_type == exam_type,
                    ProblemMetadata.year == year,
                    ProblemMetadata.subject == subject
                ).first()
                
                if existing_metadata:
                    print(f"スキップ: {json_file.name} (既に登録済み)")
                    skipped_count += 1
                    continue
                
                # 新しい構造でメタデータを作成
                metadata = ProblemMetadata(
                    exam_type=exam_type,
                    year=year,
                    subject=subject
                )
                db.add(metadata)
                db.flush()  # IDを取得するためにflush
                
                # 詳細情報を作成（設問1として全体の問題文を保存）
                detail = ProblemDetails(
                    problem_metadata_id=metadata.id,
                    question_number=1,  # 設問1として扱う
                    question_text=text,
                    purpose=purpose if purpose else None,
                    pdf_path=source_pdf,
                )
                db.add(detail)
                db.commit()
                
                print(f"登録: {json_file.name}")
                print(f"  {exam_type} {year}年 {subject}")
                print(f"  メタデータID: {metadata.id}, 詳細ID: {detail.id}")
                imported_count += 1
                
            except Exception as e:
                db.rollback()
                print(f"エラー: {json_file.name} - {str(e)}")
                error_count += 1
        
        print("\n" + "=" * 60)
        print(f"処理完了:")
        print(f"  登録: {imported_count}件")
        print(f"  スキップ: {skipped_count}件")
        print(f"  エラー: {error_count}件")
        
    finally:
        db.close()

if __name__ == "__main__":
    # コマンドライン引数からJSONディレクトリを取得
    if len(sys.argv) > 1:
        json_dir_path = Path(sys.argv[1])
        if not json_dir_path.is_absolute():
            json_dir_path = BASE_DIR / json_dir_path
    else:
        # デフォルト: H30のJSONディレクトリ
        JSON_DIR = BASE_DIR / "data" / "json" / "preliminary_exam" / "H30"
        json_dir_path = JSON_DIR
    
    if not json_dir_path.exists():
        print(f"エラー: ディレクトリが見つかりません: {json_dir_path}")
        sys.exit(1)
    
    print(f"JSONディレクトリ: {json_dir_path}")
    import_json_files(json_dir_path)
