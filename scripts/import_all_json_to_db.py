#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
data/jsonディレクトリ内のすべてのJSONファイルをデータベースに一括インポート

使用方法:
    python import_all_json_to_db.py
    python import_all_json_to_db.py --dry-run  # 実行前の確認のみ
"""

import json
import sys
import argparse
from pathlib import Path

# プロジェクトルートをパスに追加
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))

from app.db import SessionLocal
from app.models import ProblemMetadata, ProblemDetails

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

def import_json_file(json_file: Path, db, dry_run: bool = False):
    """単一のJSONファイルをデータベースに登録"""
    try:
        # JSONファイルを読み込み
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        year_str = data.get("year", "")
        exam_type = data.get("exam_type", "")
        subject = data.get("subject", "")
        text = data.get("text", "")
        source_pdf = data.get("source_pdf", "")
        purpose = data.get("purpose", "")
        
        # 年度を整数に変換
        try:
            year = year_to_int(year_str)
        except ValueError as e:
            return {"status": "error", "message": str(e)}
        
        # 試験種別を正規化（"予備" -> "予備試験"）
        if exam_type == "予備":
            exam_type = "予備試験"
        elif exam_type == "司法":
            exam_type = "司法試験"
        
        # 短答式問題はスキップ（別のテーブルで管理）
        if "短答" in subject or "短答" in json_file.name:
            return {"status": "skipped", "message": "短答式問題は別のスクリプトでインポートしてください"}
        
        if dry_run:
            # 既存チェックのみ
            existing_metadata = db.query(ProblemMetadata).filter(
                ProblemMetadata.exam_type == exam_type,
                ProblemMetadata.year == year,
                ProblemMetadata.subject == subject
            ).first()
            
            if existing_metadata:
                return {"status": "exists", "message": "既に登録済み"}
            else:
                return {"status": "new", "message": "新規登録予定"}
        
        # 既存のメタデータをチェック
        existing_metadata = db.query(ProblemMetadata).filter(
            ProblemMetadata.exam_type == exam_type,
            ProblemMetadata.year == year,
            ProblemMetadata.subject == subject
        ).first()
        
        if existing_metadata:
            return {"status": "skipped", "message": "既に登録済み"}
        
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
        
        return {
            "status": "imported",
            "message": f"{exam_type} {year}年 {subject}",
            "metadata_id": metadata.id,
            "detail_id": detail.id
        }
        
    except Exception as e:
        if not dry_run:
            db.rollback()
        return {"status": "error", "message": str(e)}

def find_all_json_files(json_base_dir: Path):
    """再帰的にすべてのJSONファイルを検索"""
    json_files = []
    for json_file in json_base_dir.rglob("*.json"):
        # 短答式問題は除外（別のスクリプトで処理）
        if "短答" not in json_file.name:
            json_files.append(json_file)
    return sorted(json_files)

def main():
    parser = argparse.ArgumentParser(description="JSONファイルをデータベースに一括インポート")
    parser.add_argument("--dry-run", action="store_true", help="実行前の確認のみ（実際には登録しない）")
    parser.add_argument("--json-dir", type=str, default=None, help="JSONディレクトリのパス（デフォルト: data/json）")
    args = parser.parse_args()
    
    # JSONディレクトリのパスを決定
    if args.json_dir:
        json_base_dir = Path(args.json_dir)
        if not json_base_dir.is_absolute():
            json_base_dir = BASE_DIR / json_base_dir
    else:
        json_base_dir = BASE_DIR / "data" / "json"
    
    if not json_base_dir.exists():
        print(f"エラー: ディレクトリが見つかりません: {json_base_dir}")
        sys.exit(1)
    
    print(f"JSONディレクトリ: {json_base_dir}")
    if args.dry_run:
        print("【DRY RUNモード】実際には登録しません")
    print("=" * 80)
    
    # すべてのJSONファイルを検索
    json_files = find_all_json_files(json_base_dir)
    print(f"見つかったJSONファイル: {len(json_files)}件")
    print("-" * 80)
    
    if not json_files:
        print("JSONファイルが見つかりませんでした。")
        return
    
    db = SessionLocal()
    
    try:
        imported_count = 0
        skipped_count = 0
        error_count = 0
        exists_count = 0
        
        for json_file in json_files:
            relative_path = json_file.relative_to(BASE_DIR)
            result = import_json_file(json_file, db, dry_run=args.dry_run)
            
            status = result["status"]
            message = result["message"]
            
            if status == "imported":
                print(f"✓ 登録: {relative_path}")
                print(f"  {message}")
                print(f"  メタデータID: {result.get('metadata_id')}, 詳細ID: {result.get('detail_id')}")
                imported_count += 1
            elif status == "skipped":
                print(f"- スキップ: {relative_path} ({message})")
                skipped_count += 1
            elif status == "exists":
                print(f"○ 既存: {relative_path} ({message})")
                exists_count += 1
            elif status == "new":
                print(f"+ 新規: {relative_path} ({message})")
                imported_count += 1
            elif status == "error":
                print(f"✗ エラー: {relative_path}")
                print(f"  {message}")
                error_count += 1
        
        print("\n" + "=" * 80)
        print("処理完了:")
        if args.dry_run:
            print(f"  新規登録予定: {imported_count}件")
            print(f"  既存: {exists_count}件")
        else:
            print(f"  登録: {imported_count}件")
            print(f"  スキップ: {skipped_count}件")
        print(f"  エラー: {error_count}件")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
